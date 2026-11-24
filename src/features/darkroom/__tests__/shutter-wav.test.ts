import { SHUTTER_SAMPLE_RATE, shutterSamples, wav } from "../shutter-wav";

const ascii = (bytes: Uint8Array, offset: number, length: number) =>
  String.fromCharCode(...bytes.slice(offset, offset + length));

describe("wav", () => {
  it("writes a 16-bit mono PCM RIFF header around the samples", () => {
    const samples = new Int16Array([0, 1000, -1000]);
    const bytes = wav(samples, 22050);
    const view = new DataView(bytes.buffer);

    expect(bytes.length).toBe(44 + 6);
    expect(ascii(bytes, 0, 4)).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(36 + 6);
    expect(ascii(bytes, 8, 4)).toBe("WAVE");
    expect(ascii(bytes, 12, 4)).toBe("fmt ");
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(22050);
    expect(view.getUint32(28, true)).toBe(22050 * 2);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(ascii(bytes, 36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(6);
    expect(view.getInt16(46, true)).toBe(1000);
    expect(view.getInt16(48, true)).toBe(-1000);
  });
});

describe("shutterSamples", () => {
  it("lasts 0.14 s and stays within 16 bits", () => {
    const samples = shutterSamples();
    expect(samples.length).toBe(Math.round(SHUTTER_SAMPLE_RATE * 0.14));
    expect(samples.some((s) => s !== 0)).toBe(true);
  });

  it("is the same click every time", () => {
    expect(shutterSamples()).toEqual(shutterSamples());
  });
});
