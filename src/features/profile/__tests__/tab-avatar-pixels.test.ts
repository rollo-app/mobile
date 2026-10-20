import { toRgba8 } from "../tab-avatar";

describe("toRgba8", () => {
  it("keeps 8-bit RGBA as is", () => {
    const data = new Uint8Array([10, 20, 30, 40]);
    expect(Array.from(toRgba8({ width: 1, height: 1, data, channels: 4, depth: 8 }))).toEqual([10, 20, 30, 40]);
  });

  it("uses the high byte of 16-bit samples", () => {
    const data = new Uint16Array([0x1234, 0xabcd, 0xff00]);
    expect(Array.from(toRgba8({ width: 1, height: 1, data, channels: 3, depth: 16 }))).toEqual([0x12, 0xab, 0xff, 255]);
  });

  it("expands gray with alpha", () => {
    const data = new Uint8Array([100, 50]);
    expect(Array.from(toRgba8({ width: 1, height: 1, data, channels: 2, depth: 8 }))).toEqual([100, 100, 100, 50]);
  });

  it("looks up indexed colors in the palette", () => {
    const data = new Uint8Array([1]);
    const palette = [
      [0, 0, 0],
      [200, 100, 50, 128],
    ];
    expect(Array.from(toRgba8({ width: 1, height: 1, data, channels: 1, depth: 8, palette }))).toEqual([200, 100, 50, 128]);
  });
});
