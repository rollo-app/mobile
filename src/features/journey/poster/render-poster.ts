// Paints the poster on a 1080×1920 offscreen Skia surface and returns its JPEG bytes. Skia only, no React.
// Layout is in film points (the poster's canonical frame) scaled by POSTER_SCALE; text and the brand are in pixels.
import { ClipOp, FilterMode, FontWeight, MipmapMode, Skia, TextAlign, TileMode, type SkImage, type SkParagraph } from "@shopify/react-native-skia";
import { disposeSurface, drawBrand, drawText, encodeStory, layoutText, makeStory, SMALL, STORY_H, STORY_W, TITLE } from "@/features/share/story-canvas";
import { drawCover, fillPaint, strokePaint, type LayerAsset } from "../engine/draw";
import { MAP_CREDIT } from "../engine/scene";
import { FILM_FRAME } from "../route";
import { placeLabels, POSTER_BAND, POSTER_SCALE, posterPinRadius, type PosterLayout } from "./poster-layout";

export type PosterInput = {
  name: string;
  dates: string;
  stats: { value: string; label: string }[];
  layout: PosterLayout;
  map: LayerAsset;
  photos: Record<string, SkImage | null>;
};

const SYSTEM_FONT = ".AppleSystemUIFont";
const ROUTE_COLOR = "#5C7CFF";
const PIN_RING = 2.5;
const LABEL_PX = 40;

/** One line of white city name with a soft black shadow, so it reads over the map and the route. */
function cityLabel(text: string, width: number): SkParagraph {
  const builder = Skia.ParagraphBuilder.Make({ maxLines: 1, ellipsis: "…", textAlign: TextAlign.Left });
  builder.pushStyle({
    color: Skia.Color("#ffffff"),
    fontFamilies: [SYSTEM_FONT],
    fontSize: LABEL_PX,
    fontStyle: { weight: FontWeight.SemiBold },
    shadows: [{ color: Skia.Color("#000000"), offset: { x: 0, y: 0 }, blurRadius: 10 }],
  });
  builder.addText(text);
  const paragraph = builder.build();
  paragraph.layout(width);
  return paragraph;
}

function fade(top: number, bottom: number, from: number, to: number) {
  const paint = Skia.Paint();
  paint.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: 0, y: top },
      { x: 0, y: bottom },
      [Skia.Color(`rgba(0,0,0,${from})`), Skia.Color(`rgba(0,0,0,${to})`)],
      [0, 1],
      TileMode.Clamp,
    ),
  );
  return paint;
}

export function renderPoster(input: PosterInput): Uint8Array {
  const { name, dates, stats, layout, map, photos } = input;
  const { surface, canvas } = makeStory();
  try {
    const frame = FILM_FRAME;
    const R = posterPinRadius(frame);

    // 1. The map over the whole frame.
    canvas.drawImageRectOptions(
      map.image,
      Skia.XYWHRect(map.src.x, map.src.y, map.src.w, map.src.h),
      Skia.XYWHRect(0, 0, STORY_W, STORY_H),
      FilterMode.Linear,
      MipmapMode.None,
      Skia.Paint(),
    );

    canvas.save();
    canvas.scale(POSTER_SCALE, POSTER_SCALE);

    // 2. The route.
    if (layout.line.length >= 2) {
      const builder = Skia.PathBuilder.Make();
      layout.line.forEach((p, i) => (i === 0 ? builder.moveTo(p.x, p.y) : builder.lineTo(p.x, p.y)));
      const path = builder.build();
      canvas.drawPath(path, strokePaint(ROUTE_COLOR, 10, 0.35));
      canvas.drawPath(path, strokePaint(ROUTE_COLOR, 3.5, 1));
    }

    // 3. The pins: a white ring and the stop's first photo in a circle.
    const white = fillPaint("#ffffff");
    const plain = Skia.Paint();
    for (const pin of layout.pins) {
      canvas.drawCircle(pin.x, pin.y, R, white);
      const r = R - PIN_RING;
      const image = photos[pin.photo];
      if (!image) {
        canvas.drawCircle(pin.x, pin.y, r, fillPaint("#d9d4c8"));
        continue;
      }
      const clip = Skia.PathBuilder.Make().addCircle(pin.x, pin.y, r).build();
      canvas.save();
      canvas.clipPath(clip, ClipOp.Intersect, true);
      drawCover(canvas, image, pin.x - r, pin.y - r, 2 * r, 2 * r, plain);
      canvas.restore();
    }

    // 4. City labels, placed so they never overlap each other or a pin.
    const bounds = { x: 0.03 * frame.w, y: POSTER_BAND.top * frame.h, w: 0.94 * frame.w, h: (POSTER_BAND.bottom - POSTER_BAND.top) * frame.h };
    const paragraphs = layout.cities.map((c) => cityLabel(c.text, bounds.w * POSTER_SCALE));
    const boxes = placeLabels({
      pins: layout.pins,
      pinRadius: R,
      cities: layout.cities,
      sizes: paragraphs.map((p) => ({ w: Math.ceil(p.getLongestLine()) / POSTER_SCALE, h: p.getHeight() / POSTER_SCALE })),
      bounds,
      gap: 3,
    });
    boxes.forEach((box, i) => {
      if (box) paragraphs[i]!.paint(canvas, box.x * POSTER_SCALE, box.y * POSTER_SCALE);
    });
    canvas.restore();

    // 5. Scrims under the title and the numbers.
    const topEnd = 0.27 * STORY_H;
    canvas.drawRect(Skia.XYWHRect(0, 0, STORY_W, topEnd), fade(0, topEnd, 0.78, 0));
    const botStart = 0.68 * STORY_H;
    canvas.drawRect(Skia.XYWHRect(0, botStart, STORY_W, STORY_H - botStart), fade(botStart, 0.76 * STORY_H, 0, 0.88));

    // 6. Title and dates.
    const titleEnd = drawText(canvas, name, { ...TITLE, maxLines: 2 }, 72, 230, 936);
    drawText(canvas, dates, { ...SMALL, maxLines: 1, opacity: 0.75 }, 72, titleEnd + 10, 936);

    // 7. The three numbers.
    stats.forEach((stat, i) => {
      const x = 72 + i * 312;
      const bottom = drawText(canvas, stat.value, { size: 88, weight: FontWeight.Bold, maxLines: 1, tabularNumbers: true }, x, 1430, 312);
      drawText(canvas, stat.label, { size: 34, maxLines: 1, opacity: 0.7 }, x, bottom, 312);
    });

    // 8. The brand and 9. the map credit.
    drawBrand(canvas, STORY_W / 2, 1720, "#ffffff", ROUTE_COLOR);
    const credit = layoutText(MAP_CREDIT, { size: 26, opacity: 0.5, maxLines: 1 }, STORY_W - 80);
    credit.paint(canvas, 40, STORY_H - 30 - credit.getHeight());

    // 10. Encoding frees the surface.
    return encodeStory(surface);
  } finally {
    disposeSurface(surface);
  }
}
