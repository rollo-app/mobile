import { Skia, type SkImage, type SkSurface } from "@shopify/react-native-skia";
import { assetUri } from "./asset-uri";
import type { Card } from "./card-layout";
import { disposeSurface, drawCover, encodeStory, makeStory, STORY_H, STORY_W } from "./story-canvas";
import { STYLE_ASSETS, type StoryStyle } from "./story-style";

async function loadStill(style: StoryStyle): Promise<SkImage> {
  const data = await Skia.Data.fromURI(await assetUri(STYLE_ASSETS[style].still));
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error("no still");
  return image;
}

/** The still 1080×1920 story ("Más opciones"): the style's background frame with the card centered on it, as a JPEG (quality 92). */
export async function composeStill(card: Card, style: StoryStyle): Promise<Uint8Array> {
  const background = await loadStill(style);
  const cardImage = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(card.png));
  let surface: SkSurface | null = null;
  try {
    if (!cardImage) throw new Error("no card");
    const story = makeStory();
    surface = story.surface;
    const { canvas } = story;
    drawCover(canvas, background, { x: 0, y: 0, w: STORY_W, h: STORY_H });
    canvas.drawImage(cardImage, Math.round((STORY_W - card.width) / 2), Math.round((STORY_H - card.height) / 2));
    return encodeStory(surface);
  } finally {
    if (surface) disposeSurface(surface);
    background.dispose();
    cardImage?.dispose();
  }
}
