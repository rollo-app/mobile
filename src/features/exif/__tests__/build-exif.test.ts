import piexif from "piexifjs";
import { asciiOnly, buildExif, xmpPacket } from "../build-exif";

const ImageIFD = piexif.ImageIFD;
const ExifIFD = piexif.ExifIFD;
const GPSIFD = piexif.GPSIFD;

// 2027-01-12 15:04:05 UTC = 12:04:05 in Buenos Aires (-03:00)
const takenAt = Date.UTC(2027, 0, 12, 15, 4, 5, 678);

const base = { takenAt, timeZone: "America/Argentina/Buenos_Aires", location: null, caption: null, author: null };

describe("buildExif dates", () => {
  it("writes the capture time in the roll's local time zone with its offset", () => {
    const { tags } = buildExif(base);
    expect(tags.Exif[ExifIFD.DateTimeOriginal]).toBe("2027:01:12 12:04:05");
    expect(tags.Exif[ExifIFD.DateTimeDigitized]).toBe("2027:01:12 12:04:05");
    expect(tags["0th"][ImageIFD.DateTime]).toBe("2027:01:12 12:04:05");
    expect(tags.Exif[0x9011]).toBe("-03:00");
    expect(tags.Exif[0x9012]).toBe("-03:00");
  });

  it("uses the offset in force at that date (positive and half-hour zones)", () => {
    const tokyo = buildExif({ ...base, timeZone: "Asia/Tokyo" }).tags;
    expect(tokyo.Exif[ExifIFD.DateTimeOriginal]).toBe("2027:01:13 00:04:05");
    expect(tokyo.Exif[0x9011]).toBe("+09:00");
    const india = buildExif({ ...base, timeZone: "Asia/Kolkata" }).tags;
    expect(india.Exif[0x9011]).toBe("+05:30");
  });

  it("sets Software to Rollo", () => {
    expect(buildExif(base).tags["0th"][ImageIFD.Software]).toBe("Rollo");
  });
});

describe("buildExif GPS", () => {
  it("writes no GPS block without a fix", () => {
    expect(buildExif(base).tags.GPS).toEqual({});
  });

  it("writes south/west coordinates as positive degrees with refs", () => {
    const { tags } = buildExif({ ...base, location: { lat: -50.3375, lng: -72.2648, accuracyM: 12.4 } });
    expect(tags.GPS[GPSIFD.GPSLatitudeRef]).toBe("S");
    expect(tags.GPS[GPSIFD.GPSLongitudeRef]).toBe("W");
    expect(piexif.GPSHelper.dmsRationalToDeg(tags.GPS[GPSIFD.GPSLatitude] as [number, number][], "S")).toBeCloseTo(-50.3375, 5);
    expect(piexif.GPSHelper.dmsRationalToDeg(tags.GPS[GPSIFD.GPSLongitude] as [number, number][], "W")).toBeCloseTo(-72.2648, 5);
    expect(tags.GPS[GPSIFD.GPSHPositioningError]).toEqual([124, 10]);
  });

  it("writes north/east refs and the UTC date and time", () => {
    const { tags } = buildExif({ ...base, location: { lat: 35.68, lng: 139.69, accuracyM: null } });
    expect(tags.GPS[GPSIFD.GPSLatitudeRef]).toBe("N");
    expect(tags.GPS[GPSIFD.GPSLongitudeRef]).toBe("E");
    expect(tags.GPS[GPSIFD.GPSDateStamp]).toBe("2027:01:12");
    expect(tags.GPS[GPSIFD.GPSTimeStamp]).toEqual([[15, 1], [4, 1], [5, 1]]);
    expect(tags.GPS[GPSIFD.GPSHPositioningError]).toBeUndefined();
  });
});

describe("buildExif caption and author", () => {
  it("writes ASCII text as is, and the same text into XMP", () => {
    const { tags, xmp } = buildExif({ ...base, caption: "Llegamos", author: "Cami" });
    expect(tags["0th"][ImageIFD.ImageDescription]).toBe("Llegamos");
    expect(tags["0th"][ImageIFD.Artist]).toBe("Cami");
    expect(xmp).toContain("Llegamos");
    expect(xmp).toContain("Cami");
  });

  it("keeps non-ASCII only in XMP, so EXIF doesn't shadow it with a degraded copy", () => {
    const { tags, xmp } = buildExif({ ...base, caption: "Laguna Capri — el viento", author: "Ñandú" });
    expect(tags["0th"][ImageIFD.ImageDescription]).toBeUndefined();
    expect(tags["0th"][ImageIFD.Artist]).toBeUndefined();
    expect(xmp).toContain("Laguna Capri — el viento");
    expect(xmp).toContain("Ñandú");
  });

  it("still writes the ASCII field when only the other one has special characters", () => {
    const { tags } = buildExif({ ...base, caption: "Llegamos", author: "Ñandú" });
    expect(tags["0th"][ImageIFD.ImageDescription]).toBe("Llegamos");
    expect(tags["0th"][ImageIFD.Artist]).toBeUndefined();
  });

  it("omits empty caption and author", () => {
    const { tags, xmp } = buildExif({ ...base, caption: "  ", author: null });
    expect(tags["0th"][ImageIFD.ImageDescription]).toBeUndefined();
    expect(tags["0th"][ImageIFD.Artist]).toBeUndefined();
    expect(xmp).toBeNull();
  });

  it("produces tags piexif can dump", () => {
    const { tags } = buildExif({ ...base, location: { lat: -50.3, lng: -72.2, accuracyM: 5 }, caption: "Ñandú — sí", author: "Ñ" });
    expect(() => piexif.dump(tags)).not.toThrow();
  });
});

describe("asciiOnly", () => {
  it("strips accents and replaces typographic punctuation", () => {
    expect(asciiOnly("Ñandú “sí” – ok… ¡vamos!")).toBe('Nandu "si" - ok... vamos!');
  });
  it("drops characters with no ASCII equivalent", () => {
    expect(asciiOnly("Hola 🔥 mundo")).toBe("Hola mundo");
  });
});

describe("xmpPacket", () => {
  it("escapes XML characters", () => {
    expect(xmpPacket("a < b & \"c\"", null)).toContain("a &lt; b &amp; &quot;c&quot;");
  });
});
