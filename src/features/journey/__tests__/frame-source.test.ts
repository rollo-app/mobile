import type { SkCanvas, SkSurface } from "@shopify/react-native-skia";

import { createFrameSource, type FrameInput } from "../frame-source";

type SetupOptions = {
  input: FrameInput;
  readReturns?: Uint8Array | null;
  texture?: { mtlTexture: bigint } | null;
  tickMs?: number;
};

function setup({ input, readReturns, texture, tickMs = 1 }: SetupOptions) {
  const made: [number, number][] = [];
  const canvasCalls: string[] = [];
  const drawn: number[] = [];
  const readInto: Uint8Array[] = [];
  const readInfo: unknown[] = [];
  const appended: [Uint8Array, number][] = [];
  const textures: bigint[] = [];
  const flushed: (boolean | undefined)[] = [];
  const disposed: string[] = [];

  const canvas = {
    save: () => canvasCalls.push("save"),
    scale: (x: number, y: number) => canvasCalls.push(`scale ${x} ${y}`),
    restore: () => canvasCalls.push("restore"),
  } as unknown as SkCanvas;

  const surface = {
    getCanvas: () => canvas,
    makeImageSnapshot: () => ({
      readPixels: (_x: number, _y: number, info: unknown, dest: Uint8Array) => {
        readInfo.push(info);
        readInto.push(dest);
        return readReturns === undefined ? dest : readReturns;
      },
      dispose: () => disposed.push("image"),
    }),
    flush: (sync?: boolean) => flushed.push(sync),
    getNativeTextureUnstable: () => (texture === undefined ? { mtlTexture: 1n } : texture),
    dispose: () => disposed.push("surface"),
  } as unknown as SkSurface;

  let clock = 0;
  const options = {
    makeSurface: (width: number, height: number) => {
      made.push([width, height]);
      return surface;
    },
    width: 1080,
    height: 1920,
    scale: 2.5,
    pixelFormat: { colorType: 6, alphaType: 2 },
    draw: (_canvas: SkCanvas, timeMs: number) => {
      drawn.push(timeMs);
    },
    input,
    appendBytes: (pixels: Uint8Array, bytesPerRow: number) => {
      appended.push([pixels, bytesPerRow]);
    },
    appendTexture: (pointer: bigint) => {
      textures.push(pointer);
    },
    now: () => (clock += tickMs),
  };

  return { options, made, canvasCalls, drawn, readInto, readInfo, appended, textures, flushed, disposed };
}

describe("createFrameSource", () => {
  it("creates one surface for the whole export", () => {
    const { options, made } = setup({ input: "bytes" });
    const source = createFrameSource(options);
    for (let i = 0; i < 3; i++) source.writeFrame(i, i * 33.3);
    expect(made).toEqual([[1080, 1920]]);
  });
  it("draws each frame scaled, inside save and restore", () => {
    const { options, canvasCalls, drawn } = setup({ input: "bytes" });
    createFrameSource(options).writeFrame(0, 100);
    expect(canvasCalls).toEqual(["save", "scale 2.5 2.5", "restore"]);
    expect(drawn).toEqual([100]);
  });
  it("bytes: reads into the same array every frame and appends it with the row size", () => {
    const { options, readInto, appended } = setup({ input: "bytes" });
    const source = createFrameSource(options);
    source.writeFrame(0, 0);
    source.writeFrame(1, 33.3);
    expect(readInto[0]).toBe(readInto[1]);
    expect(readInto[0]).toHaveLength(1080 * 1920 * 4);
    expect(appended).toEqual([[readInto[0], 4320], [readInto[0], 4320]]);
  });
  it("bytes: asks for BGRA premultiplied at the film's size", () => {
    const { options, readInfo } = setup({ input: "bytes" });
    createFrameSource(options).writeFrame(0, 0);
    expect(readInfo[0]).toEqual({ width: 1080, height: 1920, colorType: 6, alphaType: 2 });
  });
  it("bytes: uses the array Skia returns when it ignores the destination", () => {
    const other = new Uint8Array(1080 * 1920 * 4);
    const { options, appended } = setup({ input: "bytes", readReturns: other });
    createFrameSource(options).writeFrame(0, 0);
    expect(appended[0]![0]).toBe(other);
  });
  it("bytes: a failed read is an error, and the snapshot is still disposed", () => {
    const { options, disposed } = setup({ input: "bytes", readReturns: null });
    expect(() => createFrameSource(options).writeFrame(0, 0)).toThrow("readPixels failed");
    expect(disposed).toEqual(["image"]);
  });
  it("bytes: disposes each snapshot before the next frame", () => {
    const { options, disposed } = setup({ input: "bytes" });
    const source = createFrameSource(options);
    source.writeFrame(0, 0);
    source.writeFrame(1, 33.3);
    expect(disposed).toEqual(["image", "image"]);
  });
  it("texture: waits for the GPU, then hands over the Metal texture", () => {
    const { options, flushed, textures } = setup({ input: "texture", texture: { mtlTexture: 4302123456n } });
    createFrameSource(options).writeFrame(0, 0);
    expect(flushed).toEqual([true]);
    expect(textures).toEqual([4302123456n]);
  });
  it("texture: no native texture is an error", () => {
    const { options } = setup({ input: "texture", texture: null });
    expect(() => createFrameSource(options).writeFrame(0, 0)).toThrow("no native texture");
  });
  it("adds up the time of each stage", () => {
    const { options } = setup({ input: "bytes", tickMs: 2 }); // every now() call advances 2 ms
    const source = createFrameSource(options);
    source.writeFrame(0, 0);
    const s = source.stages();
    expect(s.frames).toBe(1);
    expect(s.drawMs).toBeGreaterThan(0);
    expect(s.readMs).toBeGreaterThan(0);
    expect(s.appendMs).toBeGreaterThan(0);
  });
  it("fails clearly without an offscreen surface, and disposes the one it made", () => {
    expect(() => createFrameSource({ ...setup({ input: "bytes" }).options, makeSurface: () => null })).toThrow(
      "offscreen surface unavailable",
    );
    const { options, disposed } = setup({ input: "bytes" });
    createFrameSource(options).dispose();
    expect(disposed).toEqual(["surface"]);
  });
});
