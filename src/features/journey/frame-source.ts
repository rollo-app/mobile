// Types only: Jest cannot load Skia's runtime, so every Skia value comes in through the options.
import type { SkCanvas, SkSurface } from "@shopify/react-native-skia";

export type FrameInput = "bytes" | "texture";

export type FrameStages = { frames: number; drawMs: number; readMs: number; appendMs: number };

export type FrameSourceOptions = {
  /** `Skia.Surface.MakeOffscreen`. */
  makeSurface: (width: number, height: number) => SkSurface | null;
  width: number;
  height: number;
  /** Film points to pixels (2.5 for the canonical 432×768 frame at 1080×1920). */
  scale: number;
  /** `{ colorType: ColorType.BGRA_8888, alphaType: AlphaType.Premul }`, passed in so this file imports no Skia values. */
  pixelFormat: { colorType: number; alphaType: number };
  draw: (canvas: SkCanvas, timeMs: number) => void;
  input: FrameInput;
  appendBytes: (pixels: Uint8Array, bytesPerRow: number) => void;
  appendTexture: (pointer: bigint) => void;
  now: () => number;
};

export type FrameSource = {
  writeFrame: (index: number, timeMs: number) => void;
  stages: () => FrameStages;
  dispose: () => void;
};

// The native code accepts a fourth argument (the destination array) and returns the array it
// filled, but Skia's TypeScript types only declare three parameters.
type ReadPixelsWithDest = (
  x: number,
  y: number,
  info: { width: number; height: number; colorType: number; alphaType: number },
  dest: Uint8Array,
) => Uint8Array | null;

/** Throws "offscreen surface unavailable" when `makeSurface` returns null. */
export function createFrameSource(options: FrameSourceOptions): FrameSource {
  const { makeSurface, width, height, scale, pixelFormat, draw, input, appendBytes, appendTexture, now } = options;

  const surface = makeSurface(width, height);
  if (!surface) throw new Error("offscreen surface unavailable");

  const canvas = surface.getCanvas();
  const dest = input === "bytes" ? new Uint8Array(width * height * 4) : null;
  const bytesPerRow = width * 4;
  const stages: FrameStages = { frames: 0, drawMs: 0, readMs: 0, appendMs: 0 };

  function readBytes(): Uint8Array {
    const image = surface!.makeImageSnapshot();
    try {
      const read = image.readPixels as unknown as ReadPixelsWithDest;
      const pixels = read.call(image, 0, 0, { width, height, ...pixelFormat }, dest!);
      if (!pixels) throw new Error("readPixels failed");
      return pixels;
    } finally {
      image.dispose();
    }
  }

  function readTexture(): bigint {
    surface!.flush(true);
    const native = surface!.getNativeTextureUnstable() as { mtlTexture?: bigint } | null | undefined;
    if (!native || native.mtlTexture === undefined) throw new Error("no native texture");
    return native.mtlTexture;
  }

  return {
    writeFrame(_index, timeMs) {
      const t0 = now();
      canvas.save();
      canvas.scale(scale, scale);
      try {
        draw(canvas, timeMs);
      } finally {
        canvas.restore();
      }
      const t1 = now();
      stages.drawMs += t1 - t0;

      if (input === "bytes") {
        const pixels = readBytes();
        const t2 = now();
        stages.readMs += t2 - t1;
        appendBytes(pixels, bytesPerRow);
        stages.appendMs += now() - t2;
      } else {
        const pointer = readTexture();
        const t2 = now();
        stages.readMs += t2 - t1;
        appendTexture(pointer);
        stages.appendMs += now() - t2;
      }
      stages.frames += 1;
    },
    stages: () => ({ ...stages }),
    dispose: () => surface.dispose(),
  };
}
