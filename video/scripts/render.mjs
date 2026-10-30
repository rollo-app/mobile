import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "..", "scripts", "site");
const bin = join(root, "node_modules", ".bin", "remotion");
const scale = process.env.RENDER_SCALE ?? "1";
const crf = { h264: process.env.CRF_H264 ?? "28", vp9: process.env.CRF_VP9 ?? "45" };
// Poster: 30 frames into the gallery scene (Node strips the types of timeline.ts).
const { sceneStart } = await import("../src/timeline.ts");
const posterFrame = process.env.POSTER_FRAME ?? String(sceneStart("gallery") + 30);
mkdirSync(join(root, "out"), { recursive: true });

const run = (args) => execFileSync(bin, ["render", ...args], { cwd: root, stdio: "inherit" });
const common = ["--concurrency=2", `--scale=${scale}`, "--muted"];

run(["src/index.ts", "Hero", "out/hero.mp4", "--codec", "h264", "--crf", crf.h264, "--pixel-format", "yuv420p", ...common]);
run(["src/index.ts", "Hero", "out/hero.webm", "--codec", "vp9", "--crf", crf.vp9, ...common]);
execFileSync(
  bin,
  ["still", "src/index.ts", "Hero", "out/hero-poster.jpg", `--frame=${posterFrame}`, "--image-format", "jpeg", "--jpeg-quality", "80", `--scale=${scale}`],
  { cwd: root, stdio: "inherit" },
);

const files = ["hero.mp4", "hero.webm", "hero-poster.jpg"];
let fail = false;
// Check sizes in out/ first: nothing reaches scripts/site/ if a video is over the ceiling.
for (const f of files) {
  const mb = statSync(join(root, "out", f)).size / 1024 / 1024;
  console.log(`${f}: ${mb.toFixed(2)} MB`);
  if (f.endsWith(".jpg")) continue;
  if (mb > 5) { console.error(`${f} supera 5 MB`); fail = true; }
  else if (mb > 3) console.warn(`aviso: ${f} supera 3 MB`);
}
if (!fail) for (const f of files) copyFileSync(join(root, "out", f), join(site, f));
process.exit(fail ? 1 : 0);
