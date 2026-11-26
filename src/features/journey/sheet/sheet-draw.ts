// The contact-sheet film's Skia renderer: paints a `SheetModel` (see `sheet-scene.ts`) on a canvas. The strokes (the
// developing window, the author's seal, texts, the end card) are the route film's own, exported from `engine/draw.ts`.
// Every function here is a worklet (it runs on the UI thread): no logging, nothing non-worklet.
import { Skia, TileMode, type SkCanvas, type SkImage, type SkParagraph } from "@shopify/react-native-skia";
import { drawEndCard, drawSeal, drawText, drawWindow, fillPaint, strokePaint } from "../engine/draw";
import type { SheetModel, SheetScene } from "./sheet-scene";

export type SheetAssets = {
  photos: Record<string, SkImage | null>;
  /** Laid out by the route film's `layoutTexts`, aligned with `scene.texts`. */
  texts: (SkParagraph | null)[];
};

const FRAME_BG = "#141416";
const SHEET_BG = "#0b0b0c";
const OFF_WHITE = "#FBFAF6";

function drawScrim(canvas: SkCanvas, scene: SheetScene, opacity: number) {
  "worklet";
  if (opacity <= 0.01) return;
  const { w, h } = scene.input.frame;
  const paint = Skia.Paint();
  paint.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: 0, y: 0.34 * h }, [Skia.Color("rgba(0,0,0,0.62)"), Skia.Color("rgba(0,0,0,0)")], [0, 1], TileMode.Clamp));
  paint.setAlphaf(Math.min(1, opacity));
  canvas.drawRect(Skia.XYWHRect(0, 0, w, 0.34 * h), paint);
}

function drawSheet(canvas: SkCanvas, scene: SheetScene, model: SheetModel, assets: SheetAssets) {
  "worklet";
  const { cellW, cellH, panel } = scene.layout;
  const { s, tx, ty } = model.camera;
  const { w, h } = scene.input.frame;
  canvas.save();
  canvas.translate(tx, ty);
  canvas.scale(s, s);
  canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(panel.x, panel.y, panel.w, panel.h), 5, 5), fillPaint(SHEET_BG));
  const cells = scene.layout.cells;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!;
    // Off the frame by a wide margin: skipped.
    const sx = tx + s * c.x;
    const sy = ty + s * c.y;
    if (sx > w || sy > h || sx + s * cellW < 0 || sy + s * cellH < 0) continue;
    const m = model.cells[i]!;
    // The develop blur scales with the cell (14 is the print's, on a window ~0.22 of the frame wide).
    drawWindow(canvas, assets.photos[scene.cells[i]!.id], m.develop, 1, c.x, c.y, cellW, cellH, 0.063 * cellW);
    if (m.dim > 0.005) canvas.drawRect(Skia.XYWHRect(c.x, c.y, cellW, cellH), fillPaint("#000000", 0.45 * m.dim));
  }
  // Highlights over the dimming: the off-white border (3 px on the frame) and the seal on the bottom edge (2 px ring).
  const seal = 0.115 * w;
  for (let i = 0; i < cells.length; i++) {
    const m = model.cells[i]!;
    if (m.weight <= 0.005) continue;
    const c = cells[i]!;
    const b = 3 / s;
    canvas.drawRect(Skia.XYWHRect(c.x - b / 2, c.y - b / 2, cellW + b, cellH + b), strokePaint(OFF_WHITE, b, m.weight));
    const id = scene.cells[i]!.id;
    const author = scene.authors[id];
    if (!author) continue;
    const at = scene.authorTexts[id];
    drawSeal(canvas, assets, author, at !== undefined ? at : -1, m.weight * Math.min(1, m.develop), c.x + cellW / 2, c.y + cellH, seal / s, 2 / s);
  }
  canvas.restore();
}

function drawTitles(canvas: SkCanvas, scene: SheetScene, model: SheetModel, assets: SheetAssets) {
  "worklet";
  const { w, h } = scene.input.frame;
  const x = 0.06 * w;
  // Cover and closing share the title area above the sheet.
  if (model.cover.opacity > 0.01) {
    const end = drawText(canvas, assets, scene.ix.coverName, x, 18, model.cover.opacity);
    drawText(canvas, assets, scene.ix.coverDate, x, end + 4, model.cover.opacity);
  }
  if (model.closing.opacity > 0.01) {
    const end = drawText(canvas, assets, scene.ix.closingName, x, 14, model.closing.opacity);
    drawText(canvas, assets, scene.ix.closingLine, x, end + 4, model.closing.opacity);
  }
  // The held cell's time, large, with the event name under it.
  const y = 0.1 * h;
  let timeH = 0;
  for (const item of model.title.items) {
    const p = assets.texts[item.text];
    if (p) timeH = p.getHeight();
    drawText(canvas, assets, item.text, x, y, item.opacity);
  }
  drawText(canvas, assets, scene.ix.eventName, x, y + timeH + 2, model.title.name);
}

export function drawSheetFrame(canvas: SkCanvas, scene: SheetScene, model: SheetModel, assets: SheetAssets): void {
  "worklet";
  canvas.drawColor(Skia.Color(FRAME_BG));
  // Fully black: nothing under the card shows, so none of it is drawn.
  if (model.endCard.opacity >= 0.999) {
    drawEndCard(canvas, scene.input.frame, model.endCard, assets);
    return;
  }
  drawSheet(canvas, scene, model, assets);
  drawScrim(canvas, scene, model.scrim);
  drawTitles(canvas, scene, model, assets);
  drawEndCard(canvas, scene.input.frame, model.endCard, assets);
}
