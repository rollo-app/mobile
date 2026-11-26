// The trip film's Skia renderer: paints a `FrameModel` (see `model.ts`) on a canvas.
// Every function here is a worklet (it runs on the UI thread, inside a derived value): no logging, nothing non-worklet.
import { BlurStyle, ClipOp, FilterMode, MipmapMode, PaintStyle, Skia, StrokeCap, StrokeJoin, TileMode, type SkCanvas, type SkImage, type SkParagraph } from "@shopify/react-native-skia";
import { BADGE_HEIGHT, BADGE_SVG, BADGE_WIDTH } from "./badge";
import type { FrameModel, PrintModel, Scene } from "./model";
import { PAPER, printHeight } from "./scene";

/** A map image the renderer paints from: the decoded picture and the window of it that holds the layer. */
export type LayerAsset = { image: SkImage; src: { x: number; y: number; w: number; h: number } };

/** Everything the renderer needs besides the scene: loaded once, by index (layers, texts) or by id (photos and avatars). */
export type Assets = { layers: (LayerAsset | null)[]; photos: Record<string, SkImage | null>; texts: (SkParagraph | null)[] };

const SEPIA = [0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0];
const IDENTITY = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
const ROUTE = "#5C7CFF";
const EMPTY = "#d9d4c8";

function fillPaint(color: string, alpha?: number) {
  "worklet";
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(color));
  if (alpha !== undefined) paint.setAlphaf(alpha);
  return paint;
}

function strokePaint(color: string, width: number, alpha: number) {
  "worklet";
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(width);
  paint.setStrokeCap(StrokeCap.Round);
  paint.setStrokeJoin(StrokeJoin.Round);
  paint.setColor(Skia.Color(color));
  paint.setAlphaf(alpha);
  return paint;
}

/** Draws `image` filling the window (x, y, w, h), cropped in the middle; `paint` may be null. */
function drawCover(canvas: SkCanvas, image: SkImage, x: number, y: number, w: number, h: number, paint: ReturnType<typeof Skia.Paint>) {
  "worklet";
  const iw = image.width();
  const ih = image.height();
  const k = Math.max(w / iw, h / ih);
  const sw = w / k;
  const sh = h / k;
  canvas.drawImageRectOptions(
    image,
    Skia.XYWHRect((iw - sw) / 2, (ih - sh) / 2, sw, sh),
    Skia.XYWHRect(x, y, w, h),
    FilterMode.Linear,
    MipmapMode.None,
    paint,
  );
}

/**
 * Touches the images the next move needs: one point of each, under the map. Skia decodes an image the first time it is
 * painted (several frames for a map image); here that happens while the frame is still.
 */
function warmUp(canvas: SkCanvas, model: FrameModel, assets: Assets) {
  "worklet";
  for (const layer of model.warm) {
    const asset = assets.layers[layer];
    if (!asset) continue;
    canvas.drawImageRectOptions(
      asset.image,
      Skia.XYWHRect(asset.src.x, asset.src.y, asset.src.w, asset.src.h),
      Skia.XYWHRect(0, 0, 1, 1),
      FilterMode.Nearest,
      MipmapMode.None,
      Skia.Paint(),
    );
  }
}

function drawMap(canvas: SkCanvas, scene: Scene, model: FrameModel, assets: Assets) {
  "worklet";
  for (const entry of model.map) {
    const asset = assets.layers[entry.layer];
    const spec = scene.layers[entry.layer];
    if (!asset || !spec) continue;
    const w = spec.w * entry.scale;
    const h = spec.h * entry.scale;
    const paint = Skia.Paint();
    paint.setAlphaf(entry.opacity);
    canvas.drawImageRectOptions(
      asset.image,
      Skia.XYWHRect(asset.src.x, asset.src.y, asset.src.w, asset.src.h),
      Skia.XYWHRect(entry.x - w / 2, entry.y - h / 2, w, h),
      FilterMode.Linear,
      MipmapMode.None,
      paint,
    );
  }
}

function drawLine(canvas: SkCanvas, model: FrameModel) {
  "worklet";
  if (model.line.length < 2) return;
  const builder = Skia.PathBuilder.Make();
  builder.moveTo(model.line[0]!.x, model.line[0]!.y);
  for (let i = 1; i < model.line.length; i++) builder.lineTo(model.line[i]!.x, model.line[i]!.y);
  const path = builder.build();
  canvas.drawPath(path, strokePaint(ROUTE, 10, 0.35));
  canvas.drawPath(path, strokePaint(ROUTE, 3.5, 1));
}

function drawPins(canvas: SkCanvas, scene: Scene, model: FrameModel, assets: Assets) {
  "worklet";
  for (const pin of model.pins) {
    if (pin.scale <= 0.01) continue;
    const r = 0.06 * scene.input.frame.w * pin.scale;
    canvas.drawCircle(pin.x, pin.y, r, fillPaint("#ffffff"));
    const shotId = scene.input.stops[pin.stop]?.shots[0];
    const image = shotId !== undefined ? assets.photos[shotId] : null;
    if (image) {
      canvas.save();
      canvas.clipPath(Skia.PathBuilder.Make().addCircle(pin.x, pin.y, r - 3).build(), ClipOp.Intersect, true);
      drawCover(canvas, image, pin.x - r, pin.y - r, r * 2, r * 2, Skia.Paint());
      canvas.restore();
    } else {
      canvas.drawCircle(pin.x, pin.y, r - 3, fillPaint(EMPTY));
    }
    if (pin.current) canvas.drawCircle(pin.x, pin.y, r + 4, strokePaint(ROUTE, 3, 1));
  }
}

function drawLight(canvas: SkCanvas, scene: Scene, model: FrameModel) {
  "worklet";
  if (model.light <= 0.001) return;
  const { w, h } = scene.input.frame;
  // Without the red light the map is only dimmed a little, so the prints stand out over it.
  if (!scene.input.timing.redLight) {
    canvas.drawRect(Skia.XYWHRect(0, 0, w, h), fillPaint("#000000", 0.2 * model.light));
    return;
  }
  canvas.drawRect(Skia.XYWHRect(0, 0, w, h), fillPaint("#000000", 0.25 * model.light));
  canvas.drawRect(Skia.XYWHRect(0, 0, w, h), fillPaint("rgb(255,40,26)", 0.34 * model.light));
}

function drawScrim(canvas: SkCanvas, scene: Scene) {
  "worklet";
  const { w, h } = scene.input.frame;
  const paint = Skia.Paint();
  paint.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: 0, y: 0 },
      { x: 0, y: 0.34 * h },
      [Skia.Color("rgba(0,0,0,0.62)"), Skia.Color("rgba(0,0,0,0)")],
      [0, 1],
      TileMode.Clamp,
    ),
  );
  canvas.drawRect(Skia.XYWHRect(0, 0, w, 0.34 * h), paint);
}

/** One photo window of a print: the empty paper, then the photo developing in it. */
function drawWindow(canvas: SkCanvas, image: SkImage | null | undefined, develop: number, zoomIn: number, x: number, y: number, w: number, h: number) {
  "worklet";
  canvas.drawRect(Skia.XYWHRect(x, y, w, h), fillPaint(EMPTY));
  if (develop < 0 || !image) return;
  canvas.save();
  canvas.clipRect(Skia.XYWHRect(x, y, w, h), ClipOp.Intersect, true);
  const cx = x + w / 2;
  const cy = y + h / 2;
  canvas.translate(cx, cy);
  canvas.scale(zoomIn, zoomIn);
  canvas.translate(-cx, -cy);
  // Eased out: the blur and the sepia fade away slowly at the end, so the switch to the plain photo is not a pop.
  const linear = Math.min(1, develop);
  const d = 1 - (1 - linear) * (1 - linear);
  const paint = Skia.Paint();
  paint.setAlphaf(0.55 + 0.45 * d);
  if (d < 0.999 && 14 * (1 - d) > 0.3) paint.setImageFilter(Skia.ImageFilter.MakeBlur(14 * (1 - d), 14 * (1 - d), TileMode.Clamp, null));
  if (d < 0.999) {
    const m = SEPIA.map((v, i) => v + (IDENTITY[i]! - v) * d);
    paint.setColorFilter(Skia.ColorFilter.MakeMatrix(m));
  }
  drawCover(canvas, image, x, y, w, h, paint);
  canvas.restore();
}

/**
 * The author's round avatar centred at (cx, cy), `d` across, with a 2 pt white ring: their picture, or their initial on
 * their colour. It fades in with the photo's development and is not there while the paper is still empty.
 */
function drawAvatar(canvas: SkCanvas, scene: Scene, assets: Assets, photo: string, develop: number, cx: number, cy: number, d: number) {
  "worklet";
  const author = scene.input.authors[photo];
  if (!author || develop < 0) return;
  const alpha = develop > 1 ? 1 : develop;
  if (alpha <= 0.01) return;
  const layered = alpha < 0.999;
  if (layered) {
    const layer = Skia.Paint();
    layer.setAlphaf(alpha);
    canvas.saveLayer(layer);
  }
  const r = d / 2;
  canvas.drawCircle(cx, cy, r, fillPaint("#ffffff"));
  const image = author.avatar !== null ? assets.photos[author.avatar] : null;
  if (image) {
    canvas.save();
    canvas.clipPath(Skia.PathBuilder.Make().addCircle(cx, cy, r - 2).build(), ClipOp.Intersect, true);
    drawCover(canvas, image, cx - r, cy - r, d, d, Skia.Paint());
    canvas.restore();
  } else {
    canvas.drawCircle(cx, cy, r - 2, fillPaint(author.color));
    const index = scene.authorTexts[photo];
    const paragraph = index !== undefined ? assets.texts[index] : null;
    if (paragraph) {
      // Laid out for the full size (centred in a 0.88 w box): scaled about the circle's centre for a smaller one.
      const k = d / (0.075 * scene.input.frame.w);
      canvas.save();
      canvas.translate(cx, cy);
      canvas.scale(k, k);
      paragraph.paint(canvas, -0.44 * scene.input.frame.w, -paragraph.getHeight() / 2);
      canvas.restore();
    }
  }
  if (layered) canvas.restore();
}

function drawPrint(canvas: SkCanvas, scene: Scene, print: PrintModel, assets: Assets) {
  "worklet";
  canvas.save();
  canvas.translate(print.x, print.y);
  canvas.rotate(print.rotation, 0, 0);
  canvas.scale(print.scale, print.scale);
  const layered = print.opacity < 0.999;
  if (layered) {
    const layer = Skia.Paint();
    layer.setAlphaf(Math.max(0, print.opacity));
    canvas.saveLayer(layer);
  }

  const W = print.width;
  const H = printHeight(W);
  const left = -W / 2;
  const top = -H / 2;

  const shadow = fillPaint("rgba(0,0,0,0.5)");
  shadow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 0.04 * W, true));
  canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(left, top + 0.03 * W, W, H), 0.02 * W, 0.02 * W), shadow);
  canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(left, top, W, H), 0.02 * W, 0.02 * W), fillPaint("#FBFAF6"));

  const ax = left + PAPER.border * W;
  const ay = top + PAPER.border * W;
  const aw = W * (1 - 2 * PAPER.border);
  const ah = aw / PAPER.ratio;
  const photos = print.photos;
  const avatar = 0.075 * scene.input.frame.w;
  if (photos.length >= 4) {
    const gap = PAPER.gap * W;
    const cw = (aw - gap) / 2;
    const ch = (ah - gap) / 2;
    for (let i = 0; i < 4; i++) {
      const p = photos[i]!;
      const cellX = ax + (i % 2) * (cw + gap);
      const cellY = ay + Math.floor(i / 2) * (ch + gap);
      drawWindow(canvas, assets.photos[p.photo], p.develop, p.zoomIn, cellX, cellY, cw, ch);
    }
    // Over all the cells (never under a neighbour), each centred at the bottom of its own cell.
    const small = 0.6 * avatar;
    for (let i = 0; i < 4; i++) {
      const p = photos[i]!;
      drawAvatar(canvas, scene, assets, p.photo, p.develop, ax + (i % 2) * (cw + gap) + cw / 2, ay + Math.floor(i / 2) * (ch + gap) + ch - small / 2 - 3, small);
    }
  } else if (photos.length >= 1) {
    const p = photos[0]!;
    drawWindow(canvas, assets.photos[p.photo], p.develop, p.zoomIn, ax, ay, aw, ah);
    // A seal: centred on the paper's bottom edge, half over it.
    const seal = 0.115 * scene.input.frame.w;
    drawAvatar(canvas, scene, assets, p.photo, p.develop, 0, top + H, seal);
  }

  if (layered) canvas.restore();
  canvas.restore();
}

function drawText(canvas: SkCanvas, assets: Assets, index: number, x: number, y: number, opacity: number): number {
  "worklet";
  const paragraph = index >= 0 ? assets.texts[index] : null;
  if (!paragraph || opacity <= 0.01) return y;
  // Fully in: no layer (an unbounded layer is a whole extra frame to composite, and this is most of the time).
  if (opacity >= 0.999) {
    paragraph.paint(canvas, x, y);
    return y + paragraph.getHeight();
  }
  const layer = Skia.Paint();
  layer.setAlphaf(Math.min(1, opacity));
  canvas.saveLayer(layer);
  paragraph.paint(canvas, x, y);
  canvas.restore();
  return y + paragraph.getHeight();
}

function drawTexts(canvas: SkCanvas, scene: Scene, model: FrameModel, assets: Assets) {
  "worklet";
  const { w, h } = scene.input.frame;
  const x = 0.06 * w;
  if (model.title) {
    const t = model.title;
    const day = t.day >= 0 ? assets.texts[t.day] : null;
    const dayY = 0.125 * h;
    drawText(canvas, assets, t.day, x, dayY, t.opacity);
    drawText(canvas, assets, t.place, x, dayY + (day ? day.getHeight() : 0) + 2, t.opacity);
  }
  const hook = model.hook;
  if (hook.opacity > 0.01) {
    const end = drawText(canvas, assets, hook.name, x, 0.17 * h, hook.opacity);
    drawText(canvas, assets, hook.stats, x, end + 6, hook.opacity);
  }
  const closing = model.closing;
  if (closing.opacity > 0.01) {
    const kickerEnd = drawText(canvas, assets, closing.kicker, x, 0.135 * h, closing.opacity);
    const nameEnd = drawText(canvas, assets, closing.name, x, kickerEnd + 4, closing.opacity);
    drawText(canvas, assets, closing.stats, x, nameEnd + 8, closing.opacity);
  }
}

/** The Rollo mark: three blue circles on a 120 × 120 box, back to front. */
const LOGO = [
  { x: 60, y: 60, r: 34, a: 0.22 },
  { x: 66, y: 54, r: 24, a: 0.45 },
  { x: 71, y: 49, r: 14, a: 1 },
] as const;

/** Apple's official badge, parsed once; null if the SVG can't be parsed (a hand-drawn stand-in is used then). */
const BADGE = loadBadge();

function loadBadge() {
  try {
    return Skia.SVG.MakeFromString(BADGE_SVG);
  } catch {
    return null;
  }
}

/** The map credit: bottom left, 16 points in, its bottom 10 points above the frame's bottom edge. */
function drawCredit(canvas: SkCanvas, scene: Scene, model: FrameModel, assets: Assets) {
  "worklet";
  const { credit } = model;
  if (credit.opacity <= 0.01) return;
  const paragraph = credit.text >= 0 ? assets.texts[credit.text] : null;
  if (!paragraph) return;
  drawText(canvas, assets, credit.text, 16, scene.input.frame.h - 10 - paragraph.getHeight(), credit.opacity);
}

function drawEndCard(canvas: SkCanvas, scene: Scene, model: FrameModel, assets: Assets) {
  "worklet";
  const card = model.endCard;
  if (card.opacity <= 0.001) return;
  const { w, h } = scene.input.frame;
  const o = card.opacity > 1 ? 1 : card.opacity;
  canvas.drawRect(Skia.XYWHRect(0, 0, w, h), fillPaint("#000000", o));

  const size = 0.26 * w;
  const k = size / 120;
  const cx = w / 2;
  const cy = 0.42 * h;
  for (let i = 0; i < 3; i++) {
    const c = LOGO[i]!;
    canvas.drawCircle(cx + (c.x - 60) * k, cy + (c.y - 60) * k, c.r * k, fillPaint("#5C7CFF", c.a * o));
  }
  drawText(canvas, assets, card.name, 0.06 * w, cy + size / 2 + 0.024 * h, o);

  // Apple's artwork, drawn whole and unmodified, with clear space around it; the hand-drawn stand-in only if it can't load.
  const bw = 0.4 * w;
  const by = 0.62 * h;
  if (BADGE) {
    const s = bw / BADGE_WIDTH;
    canvas.saveLayer(fillPaint("#ffffff", o));
    canvas.translate(cx - bw / 2, by - (BADGE_HEIGHT * s) / 2);
    canvas.scale(s, s);
    canvas.drawSvg(BADGE);
    canvas.restore();
    return;
  }
  const bh = 0.3 * bw;
  const radius = 0.18 * bh;
  const box = Skia.RRectXY(Skia.XYWHRect(cx - bw / 2, by - bh / 2, bw, bh), radius, radius);
  canvas.drawRRect(box, fillPaint("#000000", o));
  canvas.drawRRect(box, strokePaint("#ffffff", 1, 0.65 * o));
  const small = card.badgeSmall >= 0 ? assets.texts[card.badgeSmall] : null;
  const big = card.badgeBig >= 0 ? assets.texts[card.badgeBig] : null;
  const top = by - ((small ? small.getHeight() : 0) + (big ? big.getHeight() : 0)) / 2;
  const next = drawText(canvas, assets, card.badgeSmall, 0.06 * w, top, o);
  drawText(canvas, assets, card.badgeBig, 0.06 * w, next, o);
}

export function drawFrame(canvas: SkCanvas, scene: Scene, model: FrameModel, assets: Assets): void {
  "worklet";
  const { w, h } = scene.input.frame;
  canvas.drawColor(Skia.Color("#1c1c1e"));
  // Fully black: nothing under the card shows, so none of it is drawn.
  if (model.endCard.opacity >= 0.999) {
    drawEndCard(canvas, scene, model, assets);
    return;
  }
  warmUp(canvas, model, assets);
  drawMap(canvas, scene, model, assets);
  drawLine(canvas, model);
  drawPins(canvas, scene, model, assets);
  drawLight(canvas, scene, model);
  drawScrim(canvas, scene);
  for (const print of model.prints) drawPrint(canvas, scene, print, assets);
  drawTexts(canvas, scene, model, assets);
  drawCredit(canvas, scene, model, assets);
  if (model.flash > 0.001) canvas.drawRect(Skia.XYWHRect(0, 0, w, h), fillPaint("#ffffff", Math.min(1, model.flash)));
  drawEndCard(canvas, scene, model, assets);
}
