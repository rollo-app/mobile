import { FontWeight, Skia, TileMode, type SkCanvas, type SkImage, type SkSurface } from "@shopify/react-native-skia";
import { API_URL } from "@/config";
import type { RGB } from "@/features/trips/thumbhash-color";
import type { Rect } from "./collage";
import {
  BRAND_GAP,
  BRAND_H,
  CARD_CONTENT_W,
  CARD_PAD,
  CARD_W,
  cardHeight,
  CODE_GAP,
  CODE_H,
  CODE_LABEL_GAP,
  SMALL_LINE_H,
  type Card,
} from "./card-layout";
import { fetchImage } from "./load-images";
import {
  clipRounded,
  disposeSurface,
  drawBrand,
  drawCover,
  drawScrim,
  drawText,
  encodeCard,
  layoutText,
  makeCard,
  type TextSpec,
  SMALL,
  titleLines,
} from "./story-canvas";
import { STYLE_PALETTE, type StoryStyle } from "./story-style";

// The invitation card: the square hero (like the join screen's cover) with the text over its fade, the code below it and
// the brand. Instagram's Link sticker isn't inside it: the user places it anywhere on the background.
const HERO: Rect = { x: CARD_PAD, y: CARD_PAD, w: CARD_CONTENT_W, h: CARD_CONTENT_W };
/** Smaller than the card's corners, so the hero sits inside them. */
const HERO_RADIUS = 28;
/** Fill while nothing is drawn, the same as `EventHero`'s frame. */
const HERO_PLACEHOLDER = "#1c1c1e";
/** Text inside the hero: side padding and distance from its bottom. */
const HERO_PADDING = 56;
const HERO_TEXT_BOTTOM = 48;
const HERO_TEXT_W = HERO.w - HERO_PADDING * 2;
const HERO_SECONDARY = { ...SMALL, opacity: 0.85 };
/** Around the name: above it ("Te invito a") and below it (the caption). */
const NAME_GAP_ABOVE = 8;
const NAME_GAP_BELOW = 12;

const CODE_LETTER_SPACING = 18;
const CODE = {
  size: 110,
  weight: FontWeight.Bold,
  letterSpacing: CODE_LETTER_SPACING,
  center: true,
  tabularNumbers: true,
} satisfies TextSpec;

/**
 * Without photos: the swatches as a 4×4 grid, blurred. The grid is drawn oversized (the mockup's `scale(1.15)`) and blurred on
 * a surface of its own, before any clip, so its edges stay full color; the hero shows its middle.
 */
const SWATCH_GRID = 4;
const SWATCH_BLUR = 60;
const SWATCH_OVERSIZE = 1.15;
/** Without photos or swatches: a cobalt gradient (the only place the brand color fills anything). */
const EMPTY_GRADIENT = ["#3155F5", "#0b1a5c"];

/** The blurred swatch grid as an image `SWATCH_OVERSIZE` times the hero's side; null if the surface can't be made. */
function swatchImage(swatches: RGB[]): SkImage | null {
  const side = Math.round(HERO.w * SWATCH_OVERSIZE);
  const surface = Skia.Surface.MakeOffscreen(side, side);
  if (!surface) return null;
  try {
    const canvas = surface.getCanvas();
    const blur = Skia.Paint();
    blur.setImageFilter(Skia.ImageFilter.MakeBlur(SWATCH_BLUR, SWATCH_BLUR, TileMode.Clamp, null));
    canvas.saveLayer(blur);
    const cell = side / SWATCH_GRID;
    const paint = Skia.Paint();
    for (let i = 0; i < SWATCH_GRID * SWATCH_GRID; i++) {
      const { r, g, b } = swatches[i % swatches.length]!;
      paint.setColor(Skia.Color(`rgb(${r},${g},${b})`));
      // Half a pixel of overlap so no seam shows between cells.
      canvas.drawRect(Skia.XYWHRect((i % SWATCH_GRID) * cell, Math.floor(i / SWATCH_GRID) * cell, cell + 0.5, cell + 0.5), paint);
    }
    canvas.restore();
    surface.flush();
    return surface.makeImageSnapshot();
  } finally {
    disposeSurface(surface);
  }
}

/** The middle of the oversized swatch image, filling the hero. */
function drawSwatches(canvas: SkCanvas, image: SkImage) {
  const inset = (image.width() - HERO.w) / 2;
  canvas.drawImageRect(
    image,
    Skia.XYWHRect(inset, inset, HERO.w, HERO.h),
    Skia.XYWHRect(HERO.x, HERO.y, HERO.w, HERO.h),
    Skia.Paint(),
  );
}

function drawEmptyGradient(canvas: SkCanvas) {
  const paint = Skia.Paint();
  paint.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: HERO.x, y: HERO.y },
      { x: HERO.x + HERO.w, y: HERO.y + HERO.h },
      EMPTY_GRADIENT.map((c) => Skia.Color(c)),
      null,
      TileMode.Clamp,
    ),
  );
  canvas.drawRect(Skia.XYWHRect(HERO.x, HERO.y, HERO.w, HERO.h), paint);
}

/** "Te invito a", the name and the caption, stacked up from the bottom of the hero. */
function drawHeroText(canvas: SkCanvas, name: string, caption: string) {
  const eyebrow = layoutText("Te invito a", HERO_SECONDARY, HERO_TEXT_W);
  const title = titleLines(name, HERO_TEXT_W);
  const under = layoutText(caption, HERO_SECONDARY, HERO_TEXT_W);
  const x = HERO.x + HERO_PADDING;
  const captionTop = HERO.y + HERO.h - HERO_TEXT_BOTTOM - under.getHeight();
  const titleTop = captionTop - NAME_GAP_BELOW - title.getHeight();
  eyebrow.paint(canvas, x, titleTop - NAME_GAP_ABOVE - eyebrow.getHeight());
  title.paint(canvas, x, titleTop);
  under.paint(canvas, x, captionTop);
}

/** The pre-reveal invitation as a card. The cover is public (no token); if it fails, the swatches or the gradient. */
export async function renderInviteCard(input: {
  name: string;
  caption: string;
  code: string;
  coverUrl: string | null;
  swatches: RGB[];
  style: StoryStyle;
}): Promise<Card> {
  const cover = input.coverUrl ? await fetchImage(`${API_URL}${input.coverUrl}`) : null;
  const swatches = !cover && input.swatches.length > 0 ? swatchImage(input.swatches) : null;
  const palette = STYLE_PALETTE[input.style];
  let surface: SkSurface | null = null;
  try {
    const height = cardHeight({ kind: "invite", titleHeight: 0 });
    const card = makeCard(height, palette.card);
    surface = card.surface;
    const { canvas } = card;

    canvas.save();
    clipRounded(canvas, HERO, HERO_RADIUS);
    canvas.drawColor(Skia.Color(HERO_PLACEHOLDER));
    if (cover) drawCover(canvas, cover, HERO);
    else if (swatches) drawSwatches(canvas, swatches);
    else drawEmptyGradient(canvas);
    drawScrim(canvas, HERO);
    drawHeroText(canvas, input.name, input.caption);
    canvas.restore();

    const labelTop = HERO.y + HERO.h + CODE_LABEL_GAP;
    drawText(canvas, "Sumate con el código", { ...SMALL, color: palette.text, opacity: 0.7, center: true }, 0, labelTop, CARD_W);
    const codeTop = labelTop + SMALL_LINE_H + CODE_GAP;
    // Letter spacing also follows the last character: shifting half of it keeps the code optically centered.
    drawText(canvas, input.code, { ...CODE, color: palette.text }, CODE_LETTER_SPACING / 2, codeTop, CARD_W);

    drawBrand(canvas, CARD_W / 2, codeTop + CODE_H + BRAND_GAP + BRAND_H, palette.text);
    return { png: encodeCard(surface), width: CARD_W, height };
  } finally {
    if (surface) disposeSurface(surface);
    cover?.dispose();
    swatches?.dispose();
  }
}
