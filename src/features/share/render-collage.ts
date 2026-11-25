import type { SkImage, SkSurface } from "@shopify/react-native-skia";
import type { RevealedPhoto } from "@/features/media/revealed";
import {
  BRAND_GAP,
  BRAND_H,
  CARD_CONTENT_W,
  CARD_PAD,
  CARD_W,
  cardHeight,
  MOSAIC_GAP,
  MOSAIC_H,
  SMALL_LINE_H,
  TITLE_GAP,
  type Card,
} from "./card-layout";
import { collageLayout } from "./collage";
import { loadImages } from "./load-images";
import { clipRounded, disposeSurface, drawBrand, drawCover, drawText, encodeCard, makeCard, SMALL, titleLines } from "./story-canvas";
import { STYLE_PALETTE, type StoryStyle } from "./story-style";

// The collage card (the mockup's `.sticker`): the caption, the name, the mosaic and the brand at the bottom.
const PHOTO_GAP = 14;
const PHOTO_RADIUS = 20;

/** The revealed roll's collage as a card. Uses the photos that downloaded; throws "no images" if none did. */
export async function renderCollageCard(input: { name: string; caption: string; photos: RevealedPhoto[]; style: StoryStyle }): Promise<Card> {
  // The hero (first photo) is the biggest: it uses the 2048 px display; the rest are small cells, so the 800 px thumb does.
  const images = (await loadImages(input.photos.map((p, i) => (i === 0 ? p.displayPath : p.thumbPath)))).filter((i): i is SkImage => i !== null);
  if (images.length === 0) throw new Error("no images");
  const palette = STYLE_PALETTE[input.style];
  let surface: SkSurface | null = null;
  try {
    const title = titleLines(input.name, CARD_CONTENT_W, palette.text);
    const height = cardHeight({ kind: "collage", titleHeight: title.getHeight() });
    const card = makeCard(height, palette.card);
    surface = card.surface;
    const { canvas } = card;

    drawText(canvas, input.caption, { ...SMALL, color: palette.text, opacity: 0.7 }, CARD_PAD, CARD_PAD, CARD_CONTENT_W);
    const titleTop = CARD_PAD + SMALL_LINE_H + TITLE_GAP;
    title.paint(canvas, CARD_PAD, titleTop);

    const frame = { x: CARD_PAD, y: titleTop + title.getHeight() + MOSAIC_GAP, w: CARD_CONTENT_W, h: MOSAIC_H };
    collageLayout(images.length, frame, PHOTO_GAP).forEach((rect, i) => {
      canvas.save();
      clipRounded(canvas, rect, PHOTO_RADIUS);
      drawCover(canvas, images[i]!, rect);
      canvas.restore();
    });

    const brandBottom = frame.y + frame.h + BRAND_GAP + BRAND_H;
    drawBrand(canvas, CARD_W / 2, brandBottom, palette.text);
    return { png: encodeCard(surface), width: CARD_W, height };
  } finally {
    if (surface) disposeSurface(surface);
    for (const image of images) image.dispose();
  }
}
