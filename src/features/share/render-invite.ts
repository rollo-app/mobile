import { FontWeight, Skia, TileMode, type SkCanvas } from "@shopify/react-native-skia";
import { API_URL } from "@/config";
import type { RGB } from "@/features/trips/thumbhash-color";
import type { Rect } from "./collage";
import { fetchImage } from "./load-images";
import {
  clipRounded,
  drawBrand,
  drawCover,
  drawScrim,
  drawText,
  encodeStory,
  layoutText,
  makeStory,
  type TextSpec,
  MARGIN,
  SMALL,
  STORY_W,
  titleLines,
} from "./story-canvas";

// Layout of the invitation: the square hero (like the join screen's cover) with the text over its fade,
// the code below it and, between the code and the brand, room for Instagram's Link sticker (~340 px, ≥180).
const HERO: Rect = { x: MARGIN, y: 210, w: STORY_W - MARGIN * 2, h: STORY_W - MARGIN * 2 };
const HERO_RADIUS = 48;
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

/** "Sumate con el código" starts this far below the hero. */
const CODE_LABEL_GAP = 72;
const CODE_LABEL = { ...SMALL, opacity: 0.7, center: true };
const CODE_GAP = 8;
const CODE_LETTER_SPACING = 18;
const CODE = {
  size: 110,
  weight: FontWeight.Bold,
  letterSpacing: CODE_LETTER_SPACING,
  center: true,
  tabularNumbers: true,
} satisfies TextSpec;

/** Without photos: the swatches as a 4×4 grid, blurred, oversized like the mockup's `scale(1.15)` so the blur has no edges. */
const SWATCH_GRID = 4;
const SWATCH_BLUR = 60;
const SWATCH_OVERSIZE = 1.15;
/** Without photos or swatches: a cobalt gradient (the only place the brand color fills anything). */
const EMPTY_GRADIENT = ["#3155F5", "#0b1a5c"];

function drawSwatches(canvas: SkCanvas, swatches: RGB[]) {
  const side = HERO.w * SWATCH_OVERSIZE;
  const origin = { x: HERO.x - (side - HERO.w) / 2, y: HERO.y - (side - HERO.h) / 2 };
  const cell = side / SWATCH_GRID;
  const blur = Skia.Paint();
  blur.setImageFilter(Skia.ImageFilter.MakeBlur(SWATCH_BLUR, SWATCH_BLUR, TileMode.Clamp, null));
  canvas.saveLayer(blur);
  const paint = Skia.Paint();
  for (let i = 0; i < SWATCH_GRID * SWATCH_GRID; i++) {
    const { r, g, b } = swatches[i % swatches.length]!;
    paint.setColor(Skia.Color(`rgb(${r},${g},${b})`));
    const x = origin.x + (i % SWATCH_GRID) * cell;
    const y = origin.y + Math.floor(i / SWATCH_GRID) * cell;
    // Half a pixel of overlap so no seam shows between cells.
    canvas.drawRect(Skia.XYWHRect(x, y, cell + 0.5, cell + 0.5), paint);
  }
  canvas.restore();
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

/** The pre-reveal invitation as a 1080×1920 JPEG. The cover is public (no token); if it fails, the swatches or the gradient. */
export async function renderInvite(input: {
  name: string;
  caption: string;
  code: string;
  coverUrl: string | null;
  swatches: RGB[];
}): Promise<Uint8Array> {
  const cover = input.coverUrl ? await fetchImage(`${API_URL}${input.coverUrl}`) : null;
  const { surface, canvas } = makeStory();

  canvas.save();
  clipRounded(canvas, HERO, HERO_RADIUS);
  canvas.drawColor(Skia.Color(HERO_PLACEHOLDER));
  if (cover) drawCover(canvas, cover, HERO);
  else if (input.swatches.length > 0) drawSwatches(canvas, input.swatches);
  else drawEmptyGradient(canvas);
  drawScrim(canvas, HERO);
  drawHeroText(canvas, input.name, input.caption);
  canvas.restore();

  const codeTop = drawText(canvas, "Sumate con el código", CODE_LABEL, 0, HERO.y + HERO.h + CODE_LABEL_GAP, STORY_W) + CODE_GAP;
  // Letter spacing also follows the last character: shifting half of it keeps the code optically centered.
  drawText(canvas, input.code, CODE, CODE_LETTER_SPACING / 2, codeTop, STORY_W);

  drawBrand(canvas);
  return encodeStory(surface);
}
