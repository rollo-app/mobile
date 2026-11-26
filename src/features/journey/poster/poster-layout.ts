// The poster's layout: camera, pins, route line, label placement and numbers. Pure logic, no Skia and no React.
// Privacy: it only ever looks at the stops (cell centres in the share cut), never at a photo's own coordinates.
import { dateRange } from "@/features/share/collage";
import { dateFormatter } from "@/lib/intl";
import type { MapLayerSpec, Pt, Size } from "../engine/model";
import { thousands } from "../engine/scene";
import { FILM_FRAME, toMercator, travelZoom, type FilmCut, type Stop } from "../route";

/** Pixels per film point. */
export const POSTER_SCALE = 2.5;
/** Fractions of the frame's height that the map content (pins, labels) may use. */
export const POSTER_BAND = { top: 0.25, bottom: 0.72 };
export const posterPinRadius = (frame: Size): number => 0.048 * frame.w;

export type PosterLayout = {
  camera: { cx: number; cy: number; zoom: number };
  /** The one map image: the whole frame at the camera, without the map's own names. */
  map: MapLayerSpec;
  /** One per stop, in route order; `photo` is `stop.shots[0].id`. Frame points. */
  pins: { x: number; y: number; photo: string }[];
  /** The pins' centres, in order. */
  line: Pt[];
  /** One per distinct place name, at the first stop that has it; stops without a name give none. */
  cities: { text: string; pin: number }[];
};

const MIN_SPAN = 1e-9;

export function posterLayout(stops: Stop[], places: (string | null)[], cut: FilmCut, frame: Size = FILM_FRAME): PosterLayout {
  const R = posterPinRadius(frame);
  const fitX0 = 0.14 * frame.w;
  const fitX1 = 0.86 * frame.w;
  const fitY0 = POSTER_BAND.top * frame.h + 1.6 * R;
  const fitY1 = POSTER_BAND.bottom * frame.h - 1.6 * R;

  const merc = stops.map(toMercator);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of merc) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const dx = Math.max(maxX - minX, MIN_SPAN);
  const dy = Math.max(maxY - minY, MIN_SPAN);

  const fitW = fitX1 - fitX0;
  const fitH = fitY1 - fitY0;
  const zoom = Math.min(travelZoom(stops, frame.w, cut) - 0.4, Math.log2(Math.min(fitW / (512 * dx), fitH / (512 * dy))));
  const scale = 512 * 2 ** zoom;

  // The bbox centre lands on the fit area's centre.
  const cx = (minX + maxX) / 2 - ((fitX0 + fitX1) / 2 - frame.w / 2) / scale;
  const cy = (minY + maxY) / 2 - ((fitY0 + fitY1) / 2 - frame.h / 2) / scale;

  const pins = stops.map((stop, i) => ({
    x: frame.w / 2 + (merc[i]!.x - cx) * scale,
    y: frame.h / 2 + (merc[i]!.y - cy) * scale,
    photo: stop.shots[0]!.id,
  }));

  const cities: PosterLayout["cities"] = [];
  const seen = new Set<string>();
  places.forEach((place, pin) => {
    if (!place || seen.has(place)) return;
    seen.add(place);
    cities.push({ text: place, pin });
  });

  return {
    camera: { cx, cy, zoom },
    map: { cx, cy, zoom, w: frame.w, h: frame.h, labels: false },
    pins,
    line: pins.map((p) => ({ x: p.x, y: p.y })),
    cities,
  };
}

/** Top-left box in frame points. */
export type LabelBox = { x: number; y: number; w: number; h: number };

const MARGIN = 2;

function hitsCircle(box: LabelBox, c: Pt, r: number): boolean {
  const nx = Math.max(box.x, Math.min(c.x, box.x + box.w));
  const ny = Math.max(box.y, Math.min(c.y, box.y + box.h));
  return Math.hypot(nx - c.x, ny - c.y) < r;
}

function overlaps(a: LabelBox, b: LabelBox): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Greedy, in `cities` order. Tries right, left, below, above of the pin (`gap` away from its edge, centred on the other
 * axis); null when none fits.
 */
export function placeLabels(input: {
  pins: Pt[];
  pinRadius: number;
  cities: { pin: number }[];
  sizes: Size[];
  bounds: LabelBox;
  gap: number;
}): (LabelBox | null)[] {
  const { pins, pinRadius, cities, sizes, bounds, gap } = input;
  const placed: LabelBox[] = [];
  return cities.map((city, i) => {
    const pin = pins[city.pin]!;
    const { w, h } = sizes[i]!;
    const candidates: LabelBox[] = [
      { x: pin.x + pinRadius + gap, y: pin.y - h / 2, w, h },
      { x: pin.x - pinRadius - gap - w, y: pin.y - h / 2, w, h },
      { x: pin.x - w / 2, y: pin.y + pinRadius + gap, w, h },
      { x: pin.x - w / 2, y: pin.y - pinRadius - gap - h, w, h },
    ];
    const fits = (box: LabelBox) =>
      box.x >= bounds.x &&
      box.y >= bounds.y &&
      box.x + box.w <= bounds.x + bounds.w &&
      box.y + box.h <= bounds.y + bounds.h &&
      !pins.some((p) => hitsCircle(box, p, pinRadius + MARGIN)) &&
      !placed.some((other) => overlaps(box, { x: other.x - MARGIN, y: other.y - MARGIN, w: other.w + 2 * MARGIN, h: other.h + 2 * MARGIN }));
    const box = candidates.find(fits) ?? null;
    if (box) placed.push(box);
    return box;
  });
}

export function posterStats(input: { days: number; km: number; stops: number }): { value: string; label: string }[] {
  return [
    { value: thousands(input.days), label: input.days === 1 ? "día" : "días" },
    { value: thousands(input.km), label: "km" },
    { value: thousands(input.stops), label: input.stops === 1 ? "lugar" : "lugares" },
  ];
}

/** "3 – 26 de octubre · 2026": the range in the trip's zone and the year of its end. */
export function posterDates(startsAt: number, endsAt: number, timeZone: string): string {
  const year = dateFormatter("es-AR", { timeZone, year: "numeric" }).format(endsAt);
  return `${dateRange(startsAt, endsAt, timeZone)} · ${year}`;
}
