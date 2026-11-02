import type { LiveClip } from "./live-photo.ts";

export type PhotoRecord = {
  id: string;
  file: string;
  lat: number | null;
  lng: number | null;
  /** Local wall-clock time with its own offset, e.g. "2026-07-09T12:04:40+02:00". */
  takenAt: string;
  camera: "back" | "front";
  orientation: number;
  /** Display size in pixels (orientation already applied). */
  width: number;
  height: number;
  /** Live Photo companion clip, when the photo has one. */
  live?: LiveClip;
};

/** Stored pixel size -> size as displayed: EXIF orientations 5-8 swap the axes. */
export function displaySize(
  width: number,
  height: number,
  orientation: number,
): { width: number; height: number } {
  return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
}

const pad = (n: number) => String(n).padStart(2, "0");

function parseOffsetMinutes(offset: string): number {
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(offset.trim());
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/** Formats an instant as local time at `offset`, independent of the machine's zone. */
export function formatWithOffset(instant: Date, offset: string): string {
  const minutes = parseOffsetMinutes(offset);
  const shifted = new Date(instant.getTime() + minutes * 60_000);
  const abs = Math.abs(minutes);
  const suffix = `${minutes < 0 ? "-" : "+"}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}${suffix}`
  );
}

/**
 * exifr revives "2026:07:09 12:04:40" in the machine's time zone, which is wrong here:
 * the string is wall-clock time at `offset`. Returns the real instant.
 */
export function parseExifDate(wall: string, offset: string): Date | null {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(wall);
  if (!m) return null;
  const asUtc = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!);
  return new Date(asUtc - parseOffsetMinutes(offset) * 60_000);
}

export function toPhotoRecord(
  id: string,
  exif: Record<string, unknown>,
  live?: LiveClip,
): PhotoRecord {
  const date = exif.DateTimeOriginal;
  const offset =
    typeof exif.OffsetTimeOriginal === "string" ? exif.OffsetTimeOriginal : "+00:00";
  const takenAt = date instanceof Date ? formatWithOffset(date, offset) : "";
  const lens = typeof exif.LensModel === "string" ? exif.LensModel : "";
  const orientation = typeof exif.Orientation === "number" ? exif.Orientation : 1;
  const size = displaySize(
    typeof exif.PixelWidth === "number" ? exif.PixelWidth : 0,
    typeof exif.PixelHeight === "number" ? exif.PixelHeight : 0,
    orientation,
  );
  return {
    id,
    file: `photos/${id}.jpg`,
    lat: typeof exif.latitude === "number" ? exif.latitude : null,
    lng: typeof exif.longitude === "number" ? exif.longitude : null,
    takenAt,
    camera: /front/i.test(lens) ? "front" : "back",
    orientation,
    width: size.width,
    height: size.height,
    ...(live ? { live } : {}),
  };
}
