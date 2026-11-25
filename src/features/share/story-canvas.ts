import {
  ClipOp,
  FontWeight,
  ImageFormat,
  Skia,
  TextAlign,
  TileMode,
  type SkCanvas,
  type SkImage,
  type SkParagraph,
  type SkPath,
  type SkSurface,
} from "@shopify/react-native-skia";
import type { Rect } from "./collage";

// The Stories image, in pixels. The mockup (stories-v1.html) is 270×480: everything here is it ×4.
export const STORY_W = 1080;
export const STORY_H = 1920;
export const BACKGROUND = "#0b0b0c";
/** Side margin of both images. */
export const MARGIN = 64;

/** iOS's system font (SF). The family name Core Text uses for it; React Native maps "System" to the same. */
const SYSTEM_FONT = ".AppleSystemUIFont";

export type TextSpec = {
  size: number;
  weight?: FontWeight;
  /** Of the white. */
  opacity?: number;
  center?: boolean;
  letterSpacing?: number;
  lineHeight?: number;
  maxLines?: number;
  tabularNumbers?: boolean;
};

/** Secondary lines (the caption, "Te invito a"): 34 px. Callers set the opacity. */
export const SMALL = { size: 34 } satisfies TextSpec;
/** The roll's name: bold 76 px, up to 3 lines with "…", tight like `.name` in the mockup. */
export const TITLE = {
  size: 76,
  weight: FontWeight.Bold,
  letterSpacing: -1,
  lineHeight: 1.1,
  maxLines: 3,
} satisfies TextSpec;

/** `text` in white system font, wrapped and laid out to `width`. */
export function layoutText(text: string, spec: TextSpec, width: number): SkParagraph {
  const builder = Skia.ParagraphBuilder.Make({
    maxLines: spec.maxLines,
    ellipsis: spec.maxLines ? "…" : undefined,
    textAlign: spec.center ? TextAlign.Center : TextAlign.Left,
  });
  builder.pushStyle({
    color: Skia.Color(`rgba(255,255,255,${spec.opacity ?? 1})`),
    fontFamilies: [SYSTEM_FONT],
    fontSize: spec.size,
    fontStyle: { weight: spec.weight ?? FontWeight.Normal },
    letterSpacing: spec.letterSpacing,
    heightMultiplier: spec.lineHeight,
    fontFeatures: spec.tabularNumbers ? [{ name: "tnum", value: 1 }] : undefined,
  });
  builder.addText(text);
  const paragraph = builder.build();
  paragraph.layout(width);
  return paragraph;
}

/** Paints `text` with its top-left at (x, y) and returns where it ends (y + its height). */
export function drawText(canvas: SkCanvas, text: string, spec: TextSpec, x: number, y: number, width: number): number {
  const paragraph = layoutText(text, spec, width);
  paragraph.paint(canvas, x, y);
  return y + paragraph.getHeight();
}

/** The roll's name as a title of up to 3 lines (ellipsis on the last), laid out to `width`; callers read its height. */
export const titleLines = (name: string, width: number): SkParagraph => layoutText(name, TITLE, width);

/**
 * A rect with iOS's continuous ("squircle") corners, like `borderCurve: "continuous"`. Bezier constants of
 * UIBezierPath's rounded rect; each corner spans 1.528 × radius, so the radius shrinks to fit small rects.
 */
const CORNER_SPAN = 1.52866483;
const CORNER: [number, number][] = [
  [1.08849323, 0], [0.86840689, 0.02491811], [0.66993427, 0.065496],
  [0.42071178, 0.11577566], [0.11577566, 0.42071178], [0.065496, 0.66993427],
  [0.02491811, 0.86840689], [0, 1.08849323], [0, CORNER_SPAN],
];

export function continuousRect({ x, y, w, h }: Rect, radius: number): SkPath {
  const r = Math.min(radius, Math.min(w, h) / 2 / CORNER_SPAN);
  // Clockwise from the top-left; each corner is its point plus a along the edge it comes from and b along the next one.
  const corners: [cx: number, cy: number, ux: number, uy: number, vx: number, vy: number][] = [
    [x + w, y, -1, 0, 0, 1],
    [x + w, y + h, 0, -1, -1, 0],
    [x, y + h, 1, 0, 0, -1],
    [x, y, 0, 1, 1, 0],
  ];
  const builder = Skia.PathBuilder.Make().moveTo(x + CORNER_SPAN * r, y);
  for (const [cx, cy, ux, uy, vx, vy] of corners) {
    const at = ([a, b]: [number, number]) => [cx + (a * ux + b * vx) * r, cy + (a * uy + b * vy) * r] as const;
    builder.lineTo(...at([CORNER_SPAN, 0]));
    for (let i = 0; i < CORNER.length; i += 3) {
      builder.cubicTo(...at(CORNER[i]!), ...at(CORNER[i + 1]!), ...at(CORNER[i + 2]!));
    }
  }
  return builder.close().build();
}

/** Clips what's drawn next to `rect` with continuous corners; the caller wraps it in save()/restore(). */
export function clipRounded(canvas: SkCanvas, rect: Rect, radius: number) {
  canvas.clipPath(continuousRect(rect, radius), ClipOp.Intersect, true);
}

/** Draws `image` filling `rect` (cropped in the middle, like `contentFit="cover"`). */
export function drawCover(canvas: SkCanvas, image: SkImage, rect: Rect) {
  const iw = image.width();
  const ih = image.height();
  const scale = Math.max(rect.w / iw, rect.h / ih);
  const sw = rect.w / scale;
  const sh = rect.h / scale;
  const src = Skia.XYWHRect((iw - sw) / 2, (ih - sh) / 2, sw, sh);
  // Mitchell cubic: thumbs get scaled up, and it keeps them softer than bilinear without ringing.
  canvas.drawImageRectCubic(image, src, Skia.XYWHRect(rect.x, rect.y, rect.w, rect.h), 1 / 3, 1 / 3, Skia.Paint());
}

/** The dark fade at the bottom of a photo (the same as `EventHero`): clear at 40 %, black at 0.6 at the bottom. */
export function drawScrim(canvas: SkCanvas, rect: Rect) {
  const paint = Skia.Paint();
  paint.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: 0, y: rect.y },
      { x: 0, y: rect.y + rect.h },
      [Skia.Color("rgba(0,0,0,0)"), Skia.Color("rgba(0,0,0,0)"), Skia.Color("rgba(0,0,0,0.6)")],
      [0, 0.4, 1],
      TileMode.Clamp,
    ),
  );
  canvas.drawRect(Skia.XYWHRect(rect.x, rect.y, rect.w, rect.h), paint);
}

// The brand: the "Revelado" logo (three white circles on a 120 box), "Rollo Project" beside it and the site below.
const LOGO_SIZE = 44;
/** [cx, cy, r, opacity] on the 120 box, the largest first. */
const LOGO_CIRCLES: [number, number, number, number][] = [
  [60, 60, 34, 0.18],
  [66, 54, 24, 0.38],
  [71, 49, 14, 1],
];
const WORDMARK = { size: 30, weight: FontWeight.SemiBold, letterSpacing: 0.6 } satisfies TextSpec;
const SITE = { size: 24, opacity: 0.55, center: true } satisfies TextSpec;
const LOGO_GAP = 14;
const SITE_GAP = 10;
/** Where the brand's last line ends. */
export const BRAND_BOTTOM = 1840;

/** The brand centered at the bottom, ending at `BRAND_BOTTOM`. */
export function drawBrand(canvas: SkCanvas) {
  const wordmark = layoutText("Rollo Project", WORDMARK, STORY_W);
  const site = layoutText("rolloproject.com", SITE, STORY_W);
  const siteTop = BRAND_BOTTOM - site.getHeight();
  const rowHeight = Math.max(LOGO_SIZE, wordmark.getHeight());
  const rowMid = siteTop - SITE_GAP - rowHeight / 2;
  const wordmarkWidth = wordmark.getLongestLine();
  const left = (STORY_W - (LOGO_SIZE + LOGO_GAP + wordmarkWidth)) / 2;

  const scale = LOGO_SIZE / 120;
  const logoTop = rowMid - LOGO_SIZE / 2;
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  for (const [cx, cy, r, opacity] of LOGO_CIRCLES) {
    paint.setColor(Skia.Color(`rgba(255,255,255,${opacity})`));
    canvas.drawCircle(left + cx * scale, logoTop + cy * scale, r * scale, paint);
  }
  wordmark.paint(canvas, left + LOGO_SIZE + LOGO_GAP, rowMid - wordmark.getHeight() / 2);
  site.paint(canvas, 0, siteTop);
}

/** A blank 1080×1920 story on the background color. */
export function makeStory(): { surface: SkSurface; canvas: SkCanvas } {
  const surface = Skia.Surface.MakeOffscreen(STORY_W, STORY_H);
  if (!surface) throw new Error("no surface");
  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color(BACKGROUND));
  return { surface, canvas };
}

/** The finished story as JPEG bytes (quality 92). */
export function encodeStory(surface: SkSurface): Uint8Array {
  surface.flush();
  return surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 92);
}
