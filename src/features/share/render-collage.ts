import type { SkImage, SkSurface } from "@shopify/react-native-skia";
import type { RevealedPhoto } from "@/features/media/revealed";
import { collageLayout } from "./collage";
import { loadImages } from "./load-images";
import {
  clipRounded,
  disposeSurface,
  drawBrand,
  drawCover,
  drawText,
  encodeStory,
  makeStory,
  MARGIN,
  SMALL,
  STORY_W,
  titleLines,
} from "./story-canvas";

// Layout of the collage (option B of the mockup): caption and name at the top, the mosaic below, the brand at the bottom.
const CONTENT_W = STORY_W - MARGIN * 2;
/** Top of the caption line ("3 – 9 de enero · 8 personas"). */
const CAPTION_TOP = 150;
const CAPTION = { ...SMALL, opacity: 0.7 };
/** Between the caption and the name. */
const TITLE_GAP = 8;
/** Between the end of the name (1 to 3 lines) and the mosaic. */
const MOSAIC_GAP = 48;
const MOSAIC_BOTTOM = 1600;
const PHOTO_GAP = 14;
const PHOTO_RADIUS = 28;

/** The revealed roll's collage as a 1080×1920 JPEG. Uses the photos that downloaded; throws "no images" if none did. */
export async function renderCollage(input: { name: string; caption: string; photos: RevealedPhoto[] }): Promise<Uint8Array> {
  // The hero (first photo) is the biggest: it uses the 2048 px display; the rest are small cells, so the 800 px thumb does.
  const images = (await loadImages(input.photos.map((p, i) => (i === 0 ? p.displayPath : p.thumbPath)))).filter((i): i is SkImage => i !== null);
  if (images.length === 0) throw new Error("no images");
  let surface: SkSurface | null = null;
  try {
    const story = makeStory();
    surface = story.surface;
    const { canvas } = story;
    const titleTop = drawText(canvas, input.caption, CAPTION, MARGIN, CAPTION_TOP, CONTENT_W) + TITLE_GAP;
    const title = titleLines(input.name, CONTENT_W);
    title.paint(canvas, MARGIN, titleTop);

    const mosaicTop = titleTop + title.getHeight() + MOSAIC_GAP;
    const frame = { x: MARGIN, y: mosaicTop, w: CONTENT_W, h: MOSAIC_BOTTOM - mosaicTop };
    collageLayout(images.length, frame, PHOTO_GAP).forEach((rect, i) => {
      canvas.save();
      clipRounded(canvas, rect, PHOTO_RADIUS);
      drawCover(canvas, images[i]!, rect);
      canvas.restore();
    });

    drawBrand(canvas);
    return encodeStory(surface);
  } finally {
    if (surface) disposeSurface(surface);
    for (const image of images) image.dispose();
  }
}
