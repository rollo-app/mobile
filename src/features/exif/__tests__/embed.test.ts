import { embedMetadataIfMissing } from "../embed";
import { TINY_JPEG_BASE64 } from "@/test/tiny-jpeg";
import { writeMetadata } from "../jpeg";

const input = {
  takenAt: Date.UTC(2027, 0, 12, 15, 4, 5),
  timeZone: "America/Argentina/Buenos_Aires",
  location: null,
  caption: null,
  author: "Cami",
};

function fakeFile(base64: string) {
  return { base64: jest.fn(async () => base64), write: jest.fn(async () => {}) } as any;
}

describe("embedMetadataIfMissing", () => {
  it("injects the metadata when the JPEG has no capture date", async () => {
    const file = fakeFile(TINY_JPEG_BASE64);
    expect(await embedMetadataIfMissing(file, input)).toBe(true);
    expect(file.write).toHaveBeenCalledWith(writeMetadata(TINY_JPEG_BASE64, input), { encoding: "base64" });
  });

  it("does not touch a JPEG that already has one", async () => {
    const file = fakeFile(writeMetadata(TINY_JPEG_BASE64, input));
    expect(await embedMetadataIfMissing(file, { ...input, author: "Otro" })).toBe(false);
    expect(file.write).not.toHaveBeenCalled();
  });

  it("swallows errors so the photo still gets saved", async () => {
    const file = { base64: jest.fn(async () => { throw new Error("disk"); }), write: jest.fn() } as any;
    expect(await embedMetadataIfMissing(file, input)).toBe(false);
  });
});
