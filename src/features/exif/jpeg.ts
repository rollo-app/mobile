import piexif from "piexifjs";
import { buildExif, type ExifInput } from "./build-exif";

const XMP_HEADER = "http://ns.adobe.com/xap/1.0/\0";
const DATA_URL = "data:image/jpeg;base64,";

/** UTF-8 bytes of a JS string, as a binary string (one char per byte), which is what JPEG segments need. */
function utf8Binary(text: string): string {
  return unescape(encodeURIComponent(text));
}

/** Drops every XMP APP1 segment, so the new packet is the only one. */
function stripXmp(jpeg: string): string {
  let pos = 2;
  let out = jpeg.slice(0, 2);
  while (pos + 4 <= jpeg.length && jpeg.charCodeAt(pos) === 0xff) {
    const marker = jpeg.charCodeAt(pos + 1);
    if (marker === 0xda) break; // start of scan: metadata segments are over
    const length = (jpeg.charCodeAt(pos + 2) << 8) | jpeg.charCodeAt(pos + 3);
    const segment = jpeg.slice(pos, pos + 2 + length);
    const isXmp = marker === 0xe1 && segment.startsWith(XMP_HEADER, 4);
    if (!isXmp) out += segment;
    pos += 2 + length;
  }
  return out + jpeg.slice(pos);
}

/** Inserts the XMP packet right after the EXIF/JFIF segments at the top of the file. */
function insertXmp(jpeg: string, xmp: string): string {
  const payload = XMP_HEADER + utf8Binary(xmp);
  const length = payload.length + 2;
  if (length > 0xffff) return jpeg; // won't happen with a caption, but never write a corrupt segment
  const segment = "\xff\xe1" + String.fromCharCode(length >> 8, length & 0xff) + payload;
  let pos = 2;
  while (pos + 4 <= jpeg.length && jpeg.charCodeAt(pos) === 0xff) {
    const marker = jpeg.charCodeAt(pos + 1);
    if (marker !== 0xe0 && marker !== 0xe1) break;
    pos += 2 + ((jpeg.charCodeAt(pos + 2) << 8) | jpeg.charCodeAt(pos + 3));
  }
  return jpeg.slice(0, pos) + segment + jpeg.slice(pos);
}

/**
 * Replaces the JPEG's metadata with the photo's: EXIF (date, offset, GPS, description, author)
 * plus an XMP packet with the caption and author in full Unicode. Base64 in, base64 out;
 * the compressed image data is never touched.
 */
export function writeMetadata(jpegBase64: string, input: ExifInput): string {
  const { tags, xmp } = buildExif(input);
  const withExif = piexif.insert(piexif.dump(tags), DATA_URL + jpegBase64);
  const binary = stripXmp(atob(withExif.slice(DATA_URL.length)));
  return btoa(xmp ? insertXmp(binary, xmp) : binary);
}

/** Does the JPEG already say when it was taken? Anything unreadable counts as no. */
export function hasCaptureDate(jpegBase64: string): boolean {
  try {
    const tags = piexif.load(DATA_URL + jpegBase64);
    return !!tags.Exif[piexif.ExifIFD.DateTimeOriginal];
  } catch {
    return false;
  }
}
