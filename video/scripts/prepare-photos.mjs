// Usage: npm run photos -- <zip or folder>
// Converts HEIC/JPG to 1200 px JPEGs in public/photos/ and writes src/data/photos.json
// (real GPS, time and camera from EXIF). Neither output is committed.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import exifr from "exifr";
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
  records.push(toPhotoRecord(id, { ...exif, DateTimeOriginal: date, PixelWidth, PixelHeight }));
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
  `${records.length} fotos, ${records.filter((r) => r.lat !== null).length} con GPS -> public/photos/ y src/data/photos.json`,
);
