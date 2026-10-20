import piexif from "piexifjs";
import { hasCaptureDate, writeMetadata } from "../jpeg";
import { TINY_JPEG_BASE64 } from "@/test/tiny-jpeg";

const input = {
  takenAt: Date.UTC(2027, 0, 12, 15, 4, 5),
  timeZone: "America/Argentina/Buenos_Aires",
  location: { lat: -50.3375, lng: -72.2648, accuracyM: 8 },
  caption: "Laguna Capri — el viento",
  author: "Ñandú",
};

/** The file as a binary string (one char per byte). */
const bytesOf = (b64: string) => atob(b64);
/** The XMP packet of a binary JPEG, decoded as UTF-8. */
const xmpText = (binary: string) => {
  const start = binary.indexOf(XMP_MARKER);
  const end = binary.indexOf("<?xpacket end", start);
  return decodeURIComponent(escape(binary.slice(start + XMP_MARKER.length, end)));
};
const XMP_MARKER = "http://ns.adobe.com/xap/1.0/\0";

describe("writeMetadata", () => {
  it("keeps a valid JPEG: SOI first, EOI last, same scan data", () => {
    const out = bytesOf(writeMetadata(TINY_JPEG_BASE64, input));
    expect(out.startsWith("\xff\xd8")).toBe(true);
    expect(out.endsWith("\xff\xd9")).toBe(true);
    const original = bytesOf(TINY_JPEG_BASE64);
    const scan = (b: string) => b.slice(b.indexOf("\xff\xda"));
    expect(scan(out)).toBe(scan(original));
  });

  it("writes readable EXIF with date, offset, GPS and software", () => {
    const out = writeMetadata(TINY_JPEG_BASE64, input);
    const tags = piexif.load("data:image/jpeg;base64," + out);
    expect(tags.Exif[piexif.ExifIFD.DateTimeOriginal]).toBe("2027:01:12 12:04:05");
    expect(tags.Exif[0x9011]).toBe("-03:00");
    expect(tags.GPS[piexif.GPSIFD.GPSLatitudeRef]).toBe("S");
    expect(tags["0th"][piexif.ImageIFD.ImageDescription]).toBeUndefined(); // non-ASCII: XMP only
    expect(tags["0th"][piexif.ImageIFD.Artist]).toBeUndefined();
    expect(tags["0th"][piexif.ImageIFD.Software]).toBe("Rollo");
  });

  it("writes ASCII description and author to EXIF as well", () => {
    const out = writeMetadata(TINY_JPEG_BASE64, { ...input, caption: "Llegamos", author: "Cami" });
    const tags = piexif.load("data:image/jpeg;base64," + out);
    expect(tags["0th"][piexif.ImageIFD.ImageDescription]).toBe("Llegamos");
    expect(tags["0th"][piexif.ImageIFD.Artist]).toBe("Cami");
  });

  it("embeds a single XMP packet with the caption in UTF-8", () => {
    const out = bytesOf(writeMetadata(TINY_JPEG_BASE64, input));
    const first = out.indexOf(XMP_MARKER);
    expect(first).toBeGreaterThan(0);
    expect(out.indexOf(XMP_MARKER, first + 1)).toBe(-1);
    expect(xmpText(out)).toContain("Laguna Capri — el viento");
    expect(xmpText(out)).toContain("Ñandú");
  });

  it("replaces an existing XMP packet instead of adding a second one", () => {
    const once = writeMetadata(TINY_JPEG_BASE64, input);
    const twice = bytesOf(writeMetadata(once, { ...input, caption: "Otra" }));
    expect(twice.indexOf(XMP_MARKER, twice.indexOf(XMP_MARKER) + 1)).toBe(-1);
    expect(xmpText(twice)).toContain("Otra");
    expect(xmpText(twice)).not.toContain("Laguna");
  });

  it("skips XMP and GPS when there is no caption, author or fix", () => {
    const b64 = writeMetadata(TINY_JPEG_BASE64, { ...input, location: null, caption: null, author: null });
    expect(bytesOf(b64)).not.toContain("ns.adobe.com/xap");
    expect(piexif.load("data:image/jpeg;base64," + b64).GPS).toEqual({});
  });
});

describe("hasCaptureDate", () => {
  it("is false for a JPEG without DateTimeOriginal", () => {
    expect(hasCaptureDate(TINY_JPEG_BASE64)).toBe(false);
  });
  it("is true once Rollo wrote it", () => {
    expect(hasCaptureDate(writeMetadata(TINY_JPEG_BASE64, input))).toBe(true);
  });
  it("is false (not a throw) for data that is not a JPEG", () => {
    expect(hasCaptureDate(btoa("not a jpeg"))).toBe(false);
  });
});
