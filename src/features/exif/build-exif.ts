import piexif, { type ExifDict } from "piexifjs";

export type ExifInput = {
  takenAt: number;
  /** IANA zone of the roll: the time is written as local time there, with its offset. */
  timeZone: string;
  location: { lat: number; lng: number; accuracyM: number | null } | null;
  caption: string | null;
  author: string | null;
};

export type BuiltExif = {
  tags: ExifDict;
  /** XMP packet with the full Unicode caption and author, or null if there is neither. */
  xmp: string | null;
};

// EXIF 2.31 tags that piexifjs 1.0.6 doesn't know: registered so `dump` can write them.
const OFFSET_TIME_ORIGINAL = 0x9011;
const OFFSET_TIME_DIGITIZED = 0x9012;
piexif.TAGS.Exif![OFFSET_TIME_ORIGINAL] ??= { name: "OffsetTimeOriginal", type: "Ascii" };
piexif.TAGS.Exif![OFFSET_TIME_DIGITIZED] ??= { name: "OffsetTimeDigitized", type: "Ascii" };

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** Wall-clock parts of an instant in a zone, plus the zone's UTC offset in minutes at that instant. */
function localParts(ms: number, timeZone: string) {
  const seconds = Math.floor(ms / 1000) * 1000;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(seconds)
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return { ...parts, offsetMin: Math.round((asUtc - seconds) / 60000) };
}

function formatOffset(minutes: number): string {
  const abs = Math.abs(minutes);
  return `${minutes < 0 ? "-" : "+"}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

const REPLACEMENTS: [RegExp, string][] = [
  [/[‐-―−]/g, "-"],
  [/[‘’‚]/g, "'"],
  [/[“”„]/g, '"'],
  [/…/g, "..."],
  [/[¡]/g, ""],
  [/[¿]/g, ""],
];

/**
 * ASCII-only version of a text: accents are stripped (Ñandú → Nandu), dashes and quotes become their
 * plain equivalents, and anything else (emoji) is dropped. For consumers that can't read UTF-8.
 */
export function asciiOnly(text: string): string {
  let out = text.normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const [pattern, replacement] of REPLACEMENTS) out = out.replace(pattern, replacement);
  return out
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

const isAscii = (text: string) => /^[\x20-\x7e]*$/.test(text);

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Minimal XMP packet. iOS Photos shows `dc:description` as the photo's caption. */
export function xmpPacket(caption: string | null, author: string | null): string | null {
  if (!caption && !author) return null;
  const description = caption
    ? `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(caption)}</rdf:li></rdf:Alt></dc:description>`
    : "";
  const creator = author ? `<dc:creator><rdf:Seq><rdf:li>${escapeXml(author)}</rdf:li></rdf:Seq></dc:creator>` : "";
  return (
    `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>` +
    `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
    `<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">${description}${creator}</rdf:Description>` +
    `</rdf:RDF></x:xmpmeta><?xpacket end="w"?>`
  );
}

/** Pure: the tags (for piexif.dump) and the XMP packet that describe a Rollo photo. */
export function buildExif({ takenAt, timeZone, location, caption, author }: ExifInput): BuiltExif {
  const local = localParts(takenAt, timeZone);
  const date = `${pad(local.year, 4)}:${pad(local.month)}:${pad(local.day)} ${pad(local.hour)}:${pad(local.minute)}:${pad(local.second)}`;
  const offset = formatOffset(local.offsetMin);
  const cleanCaption = caption?.trim() || null;
  const cleanAuthor = author?.trim() || null;

  const tags: ExifDict = {
    "0th": { [piexif.ImageIFD.Software]: "Rollo", [piexif.ImageIFD.DateTime]: date },
    Exif: {
      [piexif.ExifIFD.DateTimeOriginal]: date,
      [piexif.ExifIFD.DateTimeDigitized]: date,
      [OFFSET_TIME_ORIGINAL]: offset,
      [OFFSET_TIME_DIGITIZED]: offset,
    },
    GPS: {},
  };
  // Apple's ImageIO prefers the EXIF text over XMP when both exist. A degraded "Nandu" would hide the
  // real "Ñandú", so text that isn't pure ASCII goes only to XMP (UTF-8), which Photos reads in full.
  if (cleanCaption && isAscii(cleanCaption)) tags["0th"][piexif.ImageIFD.ImageDescription] = cleanCaption;
  if (cleanAuthor && isAscii(cleanAuthor)) tags["0th"][piexif.ImageIFD.Artist] = cleanAuthor;

  if (location) {
    const utc = new Date(Math.floor(takenAt / 1000) * 1000);
    const gps = tags.GPS;
    gps[piexif.GPSIFD.GPSVersionID] = [2, 3, 0, 0];
    gps[piexif.GPSIFD.GPSLatitudeRef] = location.lat < 0 ? "S" : "N";
    gps[piexif.GPSIFD.GPSLatitude] = piexif.GPSHelper.degToDmsRational(Math.abs(location.lat));
    gps[piexif.GPSIFD.GPSLongitudeRef] = location.lng < 0 ? "W" : "E";
    gps[piexif.GPSIFD.GPSLongitude] = piexif.GPSHelper.degToDmsRational(Math.abs(location.lng));
    gps[piexif.GPSIFD.GPSDateStamp] = `${pad(utc.getUTCFullYear(), 4)}:${pad(utc.getUTCMonth() + 1)}:${pad(utc.getUTCDate())}`;
    gps[piexif.GPSIFD.GPSTimeStamp] = [
      [utc.getUTCHours(), 1],
      [utc.getUTCMinutes(), 1],
      [utc.getUTCSeconds(), 1],
    ];
    if (location.accuracyM != null) gps[piexif.GPSIFD.GPSHPositioningError] = [Math.round(location.accuracyM * 10), 10];
  }

  return { tags, xmp: xmpPacket(cleanCaption, cleanAuthor) };
}
