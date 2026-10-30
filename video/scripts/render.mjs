import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "..", "scripts", "site");
const bin = join(root, "node_modules", ".bin", "remotion");
const scale = process.env.RENDER_SCALE ?? "1";
const crf = { h264: process.env.CRF_H264 ?? "28", vp9: process.env.CRF_VP9 ?? "45" };
// Poster: gallery scene start (ts: sceneStart("gallery")) + 30.
const posterFrame = process.env.POSTER_FRAME ?? "384";
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

let fail = false;
for (const [src, dest] of [["hero.mp4", "hero.mp4"], ["hero.webm", "hero.webm"], ["hero-poster.jpg", "hero-poster.jpg"]]) {
  copyFileSync(join(root, "out", src), join(site, dest));
  const mb = statSync(join(site, dest)).size / 1024 / 1024;
  console.log(`${dest}: ${mb.toFixed(2)} MB`);
  if (dest.endsWith(".jpg")) continue;
  if (mb > 3) { console.error(`${dest} supera 3 MB`); fail = true; }
  else if (mb > 2) console.warn(`aviso: ${dest} supera 2 MB`);
}
process.exit(fail ? 1 : 0);
