// Usage: npm run photos -- <zip or folder>
// Converts HEIC/JPG to 1200 px JPEGs in public/photos/ and writes src/data/photos.json
// (real GPS, time and camera from EXIF). Neither output is committed.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import exifr from "exifr";
import { pickStillAt } from "./live-photo.ts";
import { parseExifDate, toPhotoRecord } from "./photo-record.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const input = process.argv[2];
if (!input) {
  console.error("Uso: npm run photos -- <zip o carpeta>");
  process.exit(1);
}

let source = resolve(input);
let temp = null;
if (statSync(source).isFile()) {
  temp = mkdtempSync(join(tmpdir(), "rollo-photos-"));
  execFileSync("unzip", ["-q", "-o", source, "-d", temp]);
  source = temp;
}

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
const files = walk(source).filter(
  (f) => /\.(heic|jpe?g)$/i.test(f) && !basename(f).startsWith("._"),
);

const outDir = join(root, "public", "photos");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Live Photo companions (<ID>.MP4/.MOV) -> H.264 portrait clips (Chromium can't decode HEVC reliably).
const ffDir = join(root, "node_modules", "@remotion", "compositor-darwin-arm64");
const ffEnv = { ...process.env, DYLD_LIBRARY_PATH: ffDir };
const ff = (bin, args) => execFileSync(join(ffDir, bin), args, { env: ffEnv, stdio: ["ignore", "pipe", "ignore"] }).toString();
const liveDir = join(root, "public", "live");
rmSync(liveDir, { recursive: true, force: true });
mkdirSync(liveDir, { recursive: true });
const companions = new Map(
  walk(source)
    .filter((f) => /\.(mp4|mov)$/i.test(f) && !basename(f).startsWith("._"))
    .map((f) => [basename(f, extname(f)), f]),
);

function prepareLive(id) {
  const src = companions.get(id);
  if (!src) return undefined;
  const out = join(liveDir, `${id}.mp4`);
  // Rotation is applied by ffmpeg; 720 px wide, no audio, faststart.
  ff("ffmpeg", ["-y", "-i", src, "-map", "0:v:0", "-an", "-vf", "scale=720:-2", "-c:v", "libx264", "-crf", "20", "-preset", "slow",
    "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", out]);
  const data = JSON.parse(ff("ffprobe", ["-v", "error", "-show_entries", "format=duration:packet=stream_index,pts_time,duration_time,size", "-select_streams", "d", "-of", "json", src]));
  const duration = Number(JSON.parse(ff("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", out])).format.duration);
  // Data streams in Apple files: [marker (10 bytes), transform (~105 bytes)].
  const packets = data.packets ?? [];
  // (the per-frame metadata stream has many packets; these two have exactly one).
  const single = packets.filter((p) => packets.filter((q) => q.stream_index === p.stream_index).length === 1);
  const marker = single.find((p) => p.size === "10");
  const transform = single.find((p) => Number(p.size) > 50);
  const stillAt = pickStillAt({
    markerPts: marker ? Number(marker.pts_time) : undefined,
    markerDuration: marker && marker.duration_time !== "N/A" ? Number(marker.duration_time) : undefined,
    transformPts: transform ? Number(transform.pts_time) : undefined,
    duration,
  });
  return { file: `live/${id}.mp4`, stillAt: Math.round(stillAt * 1000) / 1000, duration: Math.round(duration * 1000) / 1000 };
}

const records = [];
for (const file of files) {
  const id = basename(file, extname(file));
  const out = join(outDir, `${id}.jpg`);
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", "-Z", "1200", file, "--out", out], {
    stdio: "ignore",
  });
  // Raw values: numeric Orientation, and the date as the camera wrote it (see parseExifDate).
  const size = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", out]).toString();
  const PixelWidth = Number(/pixelWidth: (\d+)/.exec(size)?.[1]);
  const PixelHeight = Number(/pixelHeight: (\d+)/.exec(size)?.[1]);
  const exif =
    (await exifr.parse(readFileSync(file), {
      gps: true,
      tiff: true,
      exif: true,
      reviveValues: false,
      translateValues: false,
    })) ?? {};
  if (!exif.OffsetTimeOriginal) {
    console.warn(`Aviso: ${basename(file)} no trae OffsetTimeOriginal; se usa +00:00 para su hora.`);
  }
  const date = parseExifDate(String(exif.DateTimeOriginal ?? ""), exif.OffsetTimeOriginal ?? "+00:00");
  records.push(toPhotoRecord(id, { ...exif, DateTimeOriginal: date, PixelWidth, PixelHeight }, prepareLive(id)));
}

// Chronological; records without a date go last.
records.sort((a, b) => {
  if (!a.takenAt) return b.takenAt ? 1 : 0;
  if (!b.takenAt) return -1;
  return a.takenAt.localeCompare(b.takenAt);
});

mkdirSync(join(root, "src", "data"), { recursive: true });
const json = JSON.stringify(records, null, 2) + "\n";
writeFileSync(join(root, "src", "data", "photos.json"), json);
// Same records for Remotion (calculateMetadata fetches it); the dir is gitignored.
writeFileSync(join(outDir, "index.json"), json);
if (temp) rmSync(temp, { recursive: true, force: true });

console.log(
  `${records.length} fotos, ${records.filter((r) => r.lat !== null).length} con GPS, ${records.filter((r) => r.live).length} con Live Photo -> public/photos/, public/live/ y src/data/photos.json`,
);
