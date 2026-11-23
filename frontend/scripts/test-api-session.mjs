import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Exercise the actual API client with local storage and controlled HTTP responses.
// No backend, live account, environment file or external request is used.
const source = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function client(fetch) {
  const storage = new Map();
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    process: { env: {} },
    window: {
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key),
      },
    },
    fetch,
    URLSearchParams,
  });
  return exports;
}

const response = (status, data) => ({ status, ok: status < 400, json: async () => data });
const oldTokens = { access_token: "expired", refresh_token: "old-refresh" };
const newTokens = { access_token: "fresh", refresh_token: "new-refresh" };

test("a clean checkout uses the same-origin proxy without a local .env file", async () => {
  const urls = [];
  const c = client(async (url) => { urls.push(url); return response(200, []); });
  assert.equal(c.API_BASE, "/api/v1");
  assert.equal(c.imageUrl("/media/photo.png"), "/media/photo.png");
  await c.api.themes.list();
  assert.deepEqual(urls, ["/api/v1/themes"]);
});

test("simultaneous expired requests share one refresh and retry with fresh credentials", async () => {
  let refreshes = 0;
  let retried = 0;
  const c = client(async (url, options) => {
    if (url.endsWith("/auth/refresh")) {
      ++refreshes;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return response(200, newTokens);
    }
    if (options.headers.Authorization === "Bearer fresh") {
      ++retried;
      return response(200, []);
    }
    return response(401, { detail: "expired" });
  });
  c.saveTokens(oldTokens);
  await Promise.all([c.api.me.get(), c.api.me.bookings()]);
  assert.equal(refreshes, 1);
  assert.equal(retried, 2);
  assert.equal(c.loadTokens().access_token, "fresh");
});

test("a late refresh response cannot sign the user back in after logout", async () => {
  let release;
  const started = new Promise((resolveStarted) => {
    release = { started: resolveStarted };
  });
  const c = client(async (url) => {
    if (url.endsWith("/auth/refresh")) {
      release.started();
      return new Promise((resolve) => { release.complete = () => resolve(response(200, newTokens)); });
    }
    return response(401, { detail: "expired" });
  });
  c.saveTokens(oldTokens);
  const request = c.api.me.get();
  await started;
  c.saveTokens(null);
  release.complete();
  await assert.rejects(request, (error) => error.status === 401);
  assert.equal(c.loadTokens(), null);
});

test("a refresh service outage keeps credentials for a later retry", async () => {
  const c = client(async (url) => response(url.endsWith("/auth/refresh") ? 503 : 401, {}));
  c.saveTokens(oldTokens);
  await assert.rejects(c.api.me.get(), (error) => error.status === 503);
  assert.equal(c.loadTokens().refresh_token, "old-refresh");
});
