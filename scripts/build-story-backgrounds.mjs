// Generates the animated backgrounds for "Compartir en Stories": a slow-drifting
// 4-stop gradient (same look as the approved "Degradé que respira" mockup), as a
// seamless 8 s loop, plus a still frame of t=0. Usage: npm run story-backgrounds
// Needs ffmpeg on PATH (or FFMPEG=/path/to/ffmpeg). No other dependencies.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "stories");
const FFMPEG = process.env.FFMPEG || "ffmpeg";

const FPS = 30;
const SECONDS = 8; // loop period: one full there-and-back of the drift
const FRAMES = FPS * SECONDS;
const W = 1080;
const H = 1920;
const LW = 270; // gradients are blurry: render small, upscale with lanczos
const LH = 480;
const ANGLE = (120 * Math.PI) / 180; // CSS linear-gradient angle

const PALETTES = {
  dark: ["#0b0b0c", "#1b2a6b", "#0b0b0c", "#3a1b4f"],
  light: ["#f3efe8", "#cfd9ff", "#f6e7d8", "#e9e4ff"],
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/**
 * Raw RGB frames of the gradient. Mirrors the CSS: a 300%x300% background whose
 * position goes (0%,30%) -> (100%,70%). `s` is a raised cosine of period SECONDS,
 * so frame FRAMES equals frame 0 and the motion eases in and out (no cut).
 */
function* frames(stops) {
  const colors = stops.map(hex);
  const bw = 3 * LW; // background image size in low-res pixels
  const bh = 3 * LH;
  const dx = Math.sin(ANGLE);
  const dy = -Math.cos(ANGLE);
  const len = Math.abs(bw * dx) + Math.abs(bh * dy); // CSS gradient line length
  for (let f = 0; f < FRAMES; f++) {
    const s = (1 - Math.cos((2 * Math.PI * f) / FRAMES)) / 2;
    const offX = (bw - LW) * s; // background-position-x: 0% -> 100%
    const offY = (bh - LH) * (0.3 + 0.4 * s); // background-position-y: 30% -> 70%
    const buf = Buffer.alloc(LW * LH * 3);
    let o = 0;
    for (let y = 0; y < LH; y++) {
      for (let x = 0; x < LW; x++) {
        const px = x + offX - bw / 2;
        const py = y + offY - bh / 2;
        const t = Math.min(1, Math.max(0, (px * dx + py * dy) / len + 0.5));
        const seg = Math.min(colors.length - 2, Math.floor(t * (colors.length - 1)));
        const k = t * (colors.length - 1) - seg;
        for (let c = 0; c < 3; c++) {
          buf[o++] = Math.round(colors[seg][c] + (colors[seg + 1][c] - colors[seg][c]) * k);
        }
      }
    }
    yield buf;
  }
}

function run(args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args, { stdio: [input ? "pipe" : "ignore", "inherit", "inherit"] });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
    if (input) {
      (async () => {
        for (const chunk of input) {
          if (!p.stdin.write(chunk)) await new Promise((r) => p.stdin.once("drain", r));
        }
        p.stdin.end();
      })().catch(reject);
    }
  });
}

// Upscale + light static noise (dithers the 8-bit banding of the smooth gradient).
const FILTER = `scale=${W}:${H}:flags=lanczos,noise=alls=4:allf=u:all_seed=7,format=yuv420p`;

mkdirSync(OUT, { recursive: true });
for (const [name, stops] of Object.entries(PALETTES)) {
  const input = ["-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${LW}x${LH}`, "-r", String(FPS), "-i", "-"];
  await run(
    ["-v", "error", "-y", ...input, "-vf", FILTER, "-c:v", "libx264", "-preset", "slow", "-crf", "24",
      "-pix_fmt", "yuv420p", "-r", String(FPS), "-t", String(SECONDS), "-an", "-movflags", "+faststart",
      join(OUT, `bg-${name}.mp4`)],
    frames(stops),
  );
  // Still frame at t=0.
  const first = frames(stops).next().value;
  await run(
    ["-v", "error", "-y", ...input, "-frames:v", "1", "-vf", FILTER.replace(",format=yuv420p", ""),
      "-q:v", "2", join(OUT, `bg-${name}.jpg`)],
    [first],
  );
  console.log(`bg-${name}.mp4 + .jpg`);
}
