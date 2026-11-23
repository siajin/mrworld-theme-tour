// 오프라인 데모용: 시드에 쓰인 Unsplash 사진을 public/images/ 로 내려받는다.
//   node scripts/fetch-images.mjs
// 이후 backend 에서 `set USE_LOCAL_IMAGES=1 && python -m app.db.seed` 로 로컬 경로로 다시 시드.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const list = JSON.parse(
  execFileSync("python", ["-c", "import json;from app.db.images import all_downloads;print(json.dumps(all_downloads()))"], {
    cwd: join(root, "..", "backend"),
    encoding: "utf-8",
  }),
);
for (const [rel, url] of list) {
  const target = join(root, "public", rel);
  await mkdir(dirname(target), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) {
    console.warn("skip", rel, res.status);
    continue;
  }
  await writeFile(target, Buffer.from(await res.arrayBuffer()));
  console.log("saved", rel);
}
