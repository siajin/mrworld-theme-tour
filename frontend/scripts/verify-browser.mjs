import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = "http://127.0.0.1:3100";
const evidence = path.resolve("../docs/final-20261122");
await mkdir(path.join(evidence, "screens"), { recursive: true });
const report = { started_at: new Date().toISOString(), base, isolation: "QA SQLite on backend8100, console SMS, rules AI", checks: [], page_errors: [], console_errors: [], failed_requests: [], http_errors: [], limitations: ["Web Speech microphone is mocked; no real recognition accuracy measurement", "SMS console mode; no live message delivery tested", "Payment simulation; no actual charge"] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const contexts = [];
const screenshots = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function context(label, viewport = { width: 1440, height: 1000 }) {
  const c = await browser.newContext({ viewport, locale: "ko-KR" });
  c.setDefaultTimeout(15000);
  contexts.push(c);
  c.on("page", (p) => {
    p.on("pageerror", (e) => report.page_errors.push({ label, message: e.message, url: p.url() }));
    p.on("console", (m) => { if (m.type() === "error") report.console_errors.push({ label, message: m.text(), url: p.url() }); });
    p.on("requestfailed", (r) => report.failed_requests.push({ label, url: r.url(), error: r.failure()?.errorText }));
    p.on("response", (r) => { if (r.status() >= 400) report.http_errors.push({ label, url: r.url(), status: r.status() }); });
  });
  return c;
}
async function check(name, fn) {
  const t = Date.now();
  try { const details = await fn(); report.checks.push({ name, passed: true, duration_ms: Date.now() - t, details }); console.log("PASS", name); }
  catch (error) { report.checks.push({ name, passed: false, duration_ms: Date.now() - t, error: error.stack }); console.log("FAIL", name, error.message); }
  await writeFile(path.join(evidence, "browser_verification.json"), JSON.stringify(report, null, 2));
}
async function shot(page, name) { const dest = path.join("screens", name + ".png"); await page.screenshot({ path: path.join(evidence, dest), fullPage: true }); screenshots.push(dest); }
async function api(c, method, resource, data, token) {
  const r = await c.request.fetch(base + "/api/v1" + resource, { method, data, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const body = await r.json(); assert(r.ok(), `${method} ${resource}: ${r.status()} ${JSON.stringify(body)}`); return body;
}
async function token(c) { return (await c.pages()[0].evaluate(() => JSON.parse(localStorage.getItem("mw_tokens") || "null")))?.access_token; }
async function login(page, email, password, target = "/login") {
  await page.goto(base + target);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 20000 });
}
async function closePopup(page) { const dialog = page.getByRole("dialog"); if (await dialog.isVisible()) await dialog.getByRole("button", { name: "닫기", exact: true }).last().click(); }
async function ready(page) { await page.locator('[aria-busy="true"]').first().waitFor({ state: "hidden", timeout: 15000 }).catch(() => {}); await delay(500); }
const guest = await context("guest"); const gp = await guest.newPage();
let catalog, pkg, dep, owner, friend, ownerContext, ownerPage, gathering;
try {
  await check("catalog proxy and fixture discovery", async () => {
    catalog = await api(guest, "GET", "/catalog");
    const packages = await api(guest, "GET", "/packages");
    const selected = packages.find((p) => p.theme.slug === "golf") ?? packages.find((p) => p.theme.slug !== "honeymoon");
    assert(selected, "No non-honeymoon package");
    pkg = await api(guest, "GET", "/packages/" + selected.id);
    dep = pkg.departures.find((d) => d.status === "open" && d.remaining >= 6 && d.depart_date >= new Date().toISOString().slice(0, 10));
    assert(dep, "No open future departure with room");
    return { packages: packages.length, package_id: pkg.id, departure_id: dep.id, catalog_styles: catalog.styles.length };
  });
  await check("guest home, themes, search and detail", async () => {
    for (const route of ["/", "/themes", "/themes/golf", "/search?theme=golf", `/packages/${pkg.id}`]) {
      const r = await gp.goto(base + route); assert(r.status() === 200); await ready(gp);
      assert((await gp.locator("body").innerText()).length > 150);
    }
    await gp.getByRole("radio", { name: /프리미엄 스타일/ }).click();
    await gp.waitForResponse((r) => r.url().includes("/bookings/quote") && r.status() === 200);
    assert.equal(await gp.getByRole("radio", { name: /프리미엄 스타일/ }).getAttribute("aria-checked"), "true");
    await shot(gp, "customer-package-options");
  });
  await check("guest checkout redirects to sign in", async () => {
    await gp.goto(`${base}/booking/${pkg.id}?departure=${dep.id}&travelers=1`);
    await gp.waitForURL((u) => u.pathname === "/login" && u.searchParams.get("next")?.includes("/booking/"));
  });
  const demo = await context("demo"); const dp = await demo.newPage();
  await check("customer login and previous-trip popup", async () => {
    await login(dp, "demo@customer.com", "demo1234");
    await dp.getByRole("dialog").waitFor();
    assert.match(await dp.getByRole("dialog").innerText(), /지난 여행/);
    await shot(dp, "customer-previous-trips");
    await closePopup(dp);
    await dp.goto(base + "/me"); await ready(dp); assert.match(await dp.locator("body").innerText(), /내 예약/);
  });
  ownerContext = await context("owner"); ownerPage = await ownerContext.newPage();
  await check("signup required fields, short password and successful registration", async () => {
    await ownerPage.goto(base + "/signup");
    await ownerPage.getByRole("button", { name: "가입하기", exact: true }).click();
    assert.equal(await ownerPage.locator("form").evaluate((f) => f.checkValidity()), false);
    const unique = Date.now(); const email = `browser-owner-${unique}@example.com`;
    await ownerPage.getByPlaceholder("여권과 같은 이름").fill("브라우저대표");
    await ownerPage.locator('input[type="email"]').fill(email);
    await ownerPage.locator('input[type="password"]').fill("123");
    assert.equal(await ownerPage.locator("form").evaluate((f) => f.checkValidity()), false);
    await ownerPage.locator('input[type="password"]').fill("browser1234");
    await ownerPage.locator('input[type="tel"]').fill("01012345678");
    await ownerPage.getByPlaceholder("예) 서울 동대문구 왕산로 200").fill("서울 테스트 주소");
    await ownerPage.locator('input[type="checkbox"]').first().check();
    await ownerPage.getByRole("button", { name: "가입하기", exact: true }).click();
    await ownerPage.waitForURL(base + "/");
    owner = { email, token: await token(ownerContext) }; assert(owner.token);
    return { email };
  });
  await check("customer cannot enter staff console", async () => {
    await ownerPage.goto(base + "/staff"); await ready(ownerPage);
    assert.match(await ownerPage.locator("body").innerText(), /직원 계정|고객 계정|직원 전용/);
    assert.equal(await ownerPage.getByRole("link", { name: "대시보드", exact: true }).count(), 0);
  });
  await check("four-step checkout retries payment503 with same reservation", async () => {
    const createIds = []; const payIds = []; let failFirst = true;
    ownerPage.on("response", async (r) => { if (r.request().method() === "POST" && r.url().endsWith("/api/v1/bookings") && r.ok()) createIds.push((await r.json()).id); });
    await ownerPage.route("**/api/v1/bookings/*/pay", async (route) => {
      payIds.push(Number(route.request().url().match(/bookings\/(\d+)\/pay/)[1]));
      if (failFirst) { failFirst = false; return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "회귀검사 결제 응답 일시 실패" }) }); }
      return route.continue();
    });
    await ownerPage.goto(`${base}/booking/${pkg.id}?departure=${dep.id}&travelers=1`);
    for (let i = 0; i < 3; i++) { const next = ownerPage.getByRole("button", { name: "다음 단계", exact: true }); await next.waitFor(); await next.click({ timeout: 15000 }); }
    await ownerPage.locator('input[type="checkbox"]').check();
    const pay = ownerPage.getByRole("button", { name: "결제하기", exact: true });
    await pay.click(); await ownerPage.getByText("회귀검사 결제 응답 일시 실패", { exact: true }).waitFor();
    await pay.click(); await ownerPage.waitForURL(/\/booking\/complete\/\d+/);
    assert.equal(createIds.length, 1); assert.equal(payIds.length, 2); assert.equal(payIds[0], payIds[1]);
    gathering = await api(ownerContext, "GET", `/bookings/${createIds[0]}`, undefined, owner.token);
    assert.equal(gathering.status, "gathering"); assert(gathering.invite_code);
    await shot(ownerPage, "customer-checkout-gathering");
    await ownerPage.unroute("**/api/v1/bookings/*/pay");
    return { created_count: createIds.length, payment_attempts: payIds.length, booking_id: gathering.id, invite_code: gathering.invite_code };
  });
  await check("pending booking resumes after full page navigation", async () => {
    const pending = await api(ownerContext, "POST", "/bookings", { package_id: pkg.id, departure_id: dep.id, style_code: "grand", hotel_grade: 4, meal_code: "local", transport_code: "van_10", travelers_count: 1, addons: [], travelers: [{ name: "브라우저대표", phone: "01012345678", is_representative: true }] }, owner.token);
    await ownerPage.goto(`${base}/me/bookings/${pending.id}`);
    await ownerPage.getByRole("heading", { name: "예약금 결제 대기" }).waitFor();
    await ready(ownerPage); await closePopup(ownerPage);
    await ownerPage.locator("#pending-payment-method").selectOption("transfer");
    const payResponse = ownerPage.waitForResponse((r) => r.url().endsWith(`/bookings/${pending.id}/pay`) && r.request().method() === "POST");
    await ownerPage.getByRole("button", { name: /예약금 .* 결제하기/ }).click();
    assert.equal((await payResponse).request().postDataJSON().method, "transfer");
    await ownerPage.getByRole("heading", { name: "예약금 결제 대기" }).waitFor({ state: "hidden" });
    const saved = await api(ownerContext, "GET", `/bookings/${pending.id}`, undefined, owner.token);
    assert.equal(saved.status, "gathering"); assert(saved.paid_at);
    await shot(ownerPage, "customer-pending-resumed");
    return { booking_id: pending.id, status: saved.status };
  });
  await check("invite join through UI reaches confirmed at minimum", async () => {
    assert(gathering?.invite_code);
    const fc = await context("friend"); const fp = await fc.newPage();
    friend = await api(fc, "POST", "/auth/signup", { email: `browser-friend-${Date.now()}@example.com`, password: "browser1234", name: "브라우저동행", phone: "01087654321", address: "서울 테스트" });
    await fc.addInitScript((tokens) => localStorage.setItem("mw_tokens", JSON.stringify(tokens)), { access_token: friend.access_token, refresh_token: friend.refresh_token });
    // A second anonymous traveler is added by the owner, leaving one invitation to reach three.
    await api(ownerContext, "POST", `/bookings/${gathering.id}/travelers`, { name: "테스트동행", phone: "01055556666", is_representative: false }, owner.token);
    await fp.goto(`${base}/join/${gathering.invite_code}`);
    await fp.getByRole("button", { name: "동행으로 합류하기" }).click();
    await fp.getByRole("heading", { name: "출발이 확정되었어요" }).waitFor();
    const saved = await api(ownerContext, "GET", `/bookings/${gathering.id}`, undefined, owner.token);
    assert.equal(saved.status, "confirmed"); assert.equal(saved.travelers_count, saved.theme.min_travelers);
    await shot(fp, "customer-invite-confirmed"); return { booking_id: saved.id, status: saved.status, travelers: saved.travelers_count };
  });
  await check("mocked speech parses command, asks confirmation, and changes style", async () => {
    const sc = await context("mocked-speech"); const sp = await sc.newPage();
    await sc.addInitScript(() => {
      const FakeRecognition = class {
        start() { this.onstart?.(); setTimeout(() => { const row = { 0: { transcript: "프리미엄으로" }, length: 1, isFinal: true }; this.onresult?.({ results: [row] }); }, 40); }
        stop() { setTimeout(() => this.onend?.(), 0); }
        abort() { this.onend?.(); }
      };
      window.SpeechRecognition = FakeRecognition;
      window.webkitSpeechRecognition = FakeRecognition;
    });
    await sp.goto(`${base}/packages/${pkg.id}`); await ready(sp);
    await sp.getByRole("button", { name: /음성/ }).first().click();
    await sp.getByRole("dialog").getByRole("button", { name: "네, 실행" }).click();
    await sp.waitForResponse((r) => r.url().includes("/bookings/quote") && r.status() === 200);
    assert.equal(await sp.getByRole("radio", { name: /프리미엄 스타일/ }).getAttribute("aria-checked"), "true");
    return { speech: "mocked", backend_intent_parser: "real", command: "프리미엄으로" };
  });
  await check("staff dashboard and all management sections", async () => {
    const staff = await context("staff"); const p = await staff.newPage();
    await login(p, "admin@mrworld.com", "admin1234", "/staff");
    await p.waitForURL(base + "/staff"); await ready(p);
    const checked = [];
    for (const route of ["/staff", "/staff/themes", "/staff/packages", "/staff/packages/new", `/staff/packages/${pkg.id}`, "/staff/departures", "/staff/inventory", "/staff/bookings", "/staff/customers", "/staff/notifications", "/staff/settings"]) {
      const r = await p.goto(base + route); assert.equal(r.status(), 200); await ready(p);
      assert(!(await p.locator("body").innerText()).includes("Application error")); checked.push(route);
    }
    await p.goto(base + "/staff/themes"); await ready(p);
    await p.getByRole("button", { name: "수정", exact: true }).first().click();
    await p.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
    await p.getByRole("dialog").waitFor({ state: "hidden" });
    await p.goto(base + "/staff/settings"); await ready(p);
    const settingsSaved = p.waitForResponse((r) => r.url().endsWith("/staff/settings") && r.request().method() === "PUT");
    await p.getByRole("button", { name: "저장", exact: true }).click();
    assert((await settingsSaved).ok());
    await p.goto(base + "/staff/inventory"); await ready(p);
    const staffToken = await token(staff);
    const beforeItems = await api(staff, "GET", "/staff/inventory/items", undefined, staffToken);
    await p.getByRole("button", { name: "입고", exact: true }).first().click();
    const stockDialog = p.getByRole("dialog");
    await stockDialog.locator('input[type="number"]').fill("3");
    await stockDialog.locator("textarea").fill("브라우저 E2E 임시 입고");
    const movedResponse = p.waitForResponse((r) => /\/inventory\/items\/\d+\/moves$/.test(r.url()) && r.request().method() === "POST");
    await stockDialog.getByRole("button", { name: "입고 처리", exact: true }).click();
    const moved = await (await movedResponse).json();
    const beforeItem = beforeItems.find((it) => it.id === moved.id); assert(beforeItem);
    assert.equal(moved.stock_qty, beforeItem.stock_qty + 3);
    await stockDialog.waitFor({ state: "hidden" });
    await p.getByRole("button", { name: "출고", exact: true }).first().click();
    await stockDialog.locator('input[type="number"]').fill(String(moved.stock_qty + 1));
    await stockDialog.getByRole("button", { name: "출고 처리", exact: true }).click();
    await stockDialog.getByText(`현재 재고(${moved.stock_qty}${moved.unit})보다 많이 출고할 수 없어요`, { exact: true }).waitFor();
    await stockDialog.locator('input[type="number"]').fill("3");
    await stockDialog.locator("textarea").fill("브라우저 E2E 임시 입고 원복");
    const restoredResponse = p.waitForResponse((r) => /\/inventory\/items\/\d+\/moves$/.test(r.url()) && r.request().method() === "POST");
    await stockDialog.getByRole("button", { name: "출고 처리", exact: true }).click();
    assert.equal((await (await restoredResponse).json()).stock_qty, beforeItem.stock_qty);
    await stockDialog.waitFor({ state: "hidden" }); await shot(p, "staff-inventory");
    await p.goto(base + "/staff/bookings"); await ready(p); await shot(p, "staff-bookings");
    return { routes: checked, theme_update: "saved unchanged", settings_update: "saved unchanged", inventory: "UI +3/-3 restored; excessive outbound blocked locally" };
  });
  await check("mobile390 customer layout, menu, detail and checkout", async () => {
    const mc = await context("mobile", { width: 390, height: 844 }); const mp = await mc.newPage();
    await mc.addInitScript((tokens) => localStorage.setItem("mw_tokens", JSON.stringify(tokens)), { access_token: owner.token, refresh_token: (await ownerPage.evaluate(() => JSON.parse(localStorage.getItem("mw_tokens"))))?.refresh_token });
    const widths = [];
    for (const route of ["/", "/search", `/packages/${pkg.id}`, `/booking/${pkg.id}?departure=${dep.id}&travelers=1`, "/me"]) {
      await mp.goto(base + route); await ready(mp);
      const w = await mp.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
      assert(w.content <= w.viewport + 1, `${route} horizontal overflow ${w.content}>${w.viewport}`); widths.push({ route, ...w });
    }
    await mp.goto(`${base}/packages/${pkg.id}`); await ready(mp); await shot(mp, "mobile390-package"); return widths;
  });
  await check("404 page and existing legal navigation", async () => {
    const r = await gp.goto(base + "/not-a-real-page-qa"); assert.equal(r.status(), 404);
    assert.match(await gp.locator("body").innerText(), /찾을 수|없는 페이지|404/);
    const links = [];
    for (const route of ["/terms", "/privacy"]) { const response = await gp.goto(base + route); links.push({ route, status: response.status() }); }
    assert(links.every((x) => x.status === 200), JSON.stringify(links)); return links;
  });
} finally {
  report.finished_at = new Date().toISOString(); report.screenshots = screenshots;
  const expectedHttp = (r) => (r.status === 503 && r.label === "owner" && /\/bookings\/\d+\/pay$/.test(r.url)) || (r.status === 404 && r.url.includes("/not-a-real-page-qa"));
  report.expected_http_errors = report.http_errors.filter(expectedHttp);
  report.unexpected_http_errors = report.http_errors.filter((r) => !expectedHttp(r));
  report.external_request_failures = report.failed_requests.filter((r) => !r.url.startsWith(base));
  report.internal_request_failures = report.failed_requests.filter((r) => r.url.startsWith(base) && r.error !== "net::ERR_ABORTED");
  report.unexpected_console_errors = report.console_errors.filter((r) => !((r.label === "owner" && r.message.includes("503")) || (r.label === "guest" && r.url.includes("not-a-real-page-qa") && r.message.includes("404"))));
  report.summary = { passed: report.checks.filter((c) => c.passed).length, failed: report.checks.filter((c) => !c.passed).length, page_errors: report.page_errors.length, unexpected_http_errors: report.unexpected_http_errors.length, unexpected_console_errors: report.unexpected_console_errors.length, internal_request_failures: report.internal_request_failures.length, external_request_failures: report.external_request_failures.length };
  await writeFile(path.join(evidence, "browser_verification.json"), JSON.stringify(report, null, 2));
  await Promise.all(contexts.map((c) => c.close())); await browser.close();
  console.log(JSON.stringify(report.summary));
}
