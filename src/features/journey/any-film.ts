// The two films the app can play and export (the route's and the contact sheet's) behind one shape, so the player and
// the exporter do not care which one they hold. Skia-drawing module: Jest never loads it for real (only its types are imported elsewhere).
import type { SkCanvas } from "@shopify/react-native-skia";
import { layoutTexts } from "./engine/assets";
import { drawFrame, type Assets } from "./engine/draw";
import type { Scene } from "./engine/model";
import { frameAt } from "./engine/scene";
import { FILM_FRAME } from "./route";
import { drawSheetFrame, type SheetAssets } from "./sheet/sheet-draw";
import { sheetFrameAt, type SheetScene } from "./sheet/sheet-scene";

/** `restAt` is the instant the player holds after the end of the film (before the end card). */
export type AnyFilm =
  | { kind: "route"; scene: Scene; assets: Assets; durationMs: number; restAt: number; version: string }
  | { kind: "sheet"; scene: SheetScene; assets: SheetAssets; durationMs: number; restAt: number; version: string };

/** Paints the film at `t` on the canonical frame. A worklet. */
export function drawAnyFilm(canvas: SkCanvas, film: AnyFilm, t: number): void {
  "worklet";
  if (film.kind === "route") drawFrame(canvas, film.scene, frameAt(film.scene, t), film.assets);
  else drawSheetFrame(canvas, film.scene, sheetFrameAt(film.scene, t), film.assets);
}

/** The same film with its own text layout, for a second thread (the export). */
export function withOwnTexts(film: AnyFilm): AnyFilm {
  const texts = layoutTexts(film.scene.texts, FILM_FRAME);
  if (film.kind === "route") return { ...film, assets: { ...film.assets, texts } };
  return { ...film, assets: { ...film.assets, texts } };
}
