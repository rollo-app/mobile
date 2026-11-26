// The Skia-touching part of the film export, apart so that Jest never loads Skia (jest.setup.ts mocks this file).
import { AlphaType, ColorType, Skia } from "@shopify/react-native-skia";
import { File, Paths } from "expo-file-system";
import { AppState } from "react-native";
import { exportFilm } from "@/features/journey/export-film";
import { layoutTexts } from "@/features/journey/engine/assets";
import { drawFrame } from "@/features/journey/engine/draw";
import { frameAt } from "@/features/journey/engine/scene";
import { createFrameSource, type FrameInput } from "@/features/journey/frame-source";
import { FILM_FRAME } from "@/features/journey/route";
import type { Film } from "@/features/journey/use-film";
import { appendFrame, appendTexture, cancelVideo, finishVideo, openVideo, type VideoFile } from "../../../modules/rollo-video";

/** How frames reach the encoder: BGRA bytes, or the Metal texture's address. */
export const FRAME_INPUT: FrameInput = "bytes";

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const BITRATE = 6_000_000;

type ReadyFilm = Extract<Film, { status: "ready" }>;

export type ExportOptions = {
  isCancelled: () => boolean;
  onProgress: (done: number, total: number) => void;
};

const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

function untilActive(): Promise<void> {
  return new Promise((resolve) => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        sub.remove();
        resolve();
      }
    });
  });
}

/** Draws the film again offscreen at 1080×1920 and writes it to `Paths.cache/rollo-recorrido-<tripId>.mp4`. Resolves null when cancelled. */
export async function exportFilmToFile(film: ReadyFilm, input: { tripId: string }, options: ExportOptions): Promise<VideoFile | null> {
  const { scene, assets } = film;
  const own = { ...assets, texts: layoutTexts(scene.texts, FILM_FRAME) };
  const source = createFrameSource({
    makeSurface: (w, h) => Skia.Surface.MakeOffscreen(w, h),
    width: WIDTH,
    height: HEIGHT,
    scale: WIDTH / FILM_FRAME.w,
    pixelFormat: { colorType: ColorType.BGRA_8888, alphaType: AlphaType.Premul },
    draw: (canvas, t) => drawFrame(canvas, scene, frameAt(scene, t), own),
    input: FRAME_INPUT,
    appendBytes: appendFrame,
    appendTexture,
    now,
  });
  try {
    return await exportFilm({
      video: { uri: new File(Paths.cache, `rollo-recorrido-${input.tripId}.mp4`).uri, width: WIDTH, height: HEIGHT, fps: FPS, bitrate: BITRATE },
      durationMs: film.durationMs,
      writeFrame: (index, timeMs) => source.writeFrame(index, timeMs),
      sink: { open: openVideo, finish: finishVideo, cancel: cancelVideo },
      isActive: () => AppState.currentState === "active",
      untilActive,
      pause: () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
      now,
      onProgress: options.onProgress,
      isCancelled: options.isCancelled,
    });
  } finally {
    source.dispose();
  }
}
