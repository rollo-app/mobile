import { buildStops, FILM_CUTS, FILM_FRAME, type FilmPhoto } from "../../route";
import { placeLabels, POSTER_BAND, posterDates, posterLayout, posterPinRadius, posterStats, type LabelBox } from "../poster-layout";

const START = Date.UTC(2027, 0, 12);

function photo(id: string, lat: number, lng: number, minutes: number): FilmPhoto {
  const takenAt = START + minutes * 60_000;
  return {
    id,
    authorId: "a",
    authorName: "A",
    authorAvatar: null,
    lat,
    lng,
    takenAt,
    day: "2027-01-12",
    likeCount: 0,
    thumb: { uri: `thumb:${id}` },
    display: { uri: `display:${id}` },
  };
}

const stopsOf = (photos: FilmPhoto[]) => buildStops(photos, FILM_CUTS.share, "2027-01-12");
const { w, h } = FILM_FRAME;
const R = posterPinRadius(FILM_FRAME);

const intersects = (a: LabelBox, b: LabelBox) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const hitsCircle = (box: LabelBox, c: { x: number; y: number }, r: number) => {
  const nx = Math.max(box.x, Math.min(c.x, box.x + box.w));
  const ny = Math.max(box.y, Math.min(c.y, box.y + box.h));
  return Math.hypot(nx - c.x, ny - c.y) < r;
};

describe("posterLayout", () => {
  it("puts every pin inside the map band", () => {
    const stops = stopsOf([photo("a", 10.1, 20.1, 0), photo("b", 11.2, 21.4, 60), photo("c", 11.9, 19.2, 120)]);
    const layout = posterLayout(stops, [null, null, null], FILM_CUTS.share);
    expect(layout.pins).toHaveLength(3);
    for (const pin of layout.pins) {
      expect(pin.x).toBeGreaterThanOrEqual(0.14 * w);
      expect(pin.x).toBeLessThanOrEqual(0.86 * w);
      expect(pin.y).toBeGreaterThanOrEqual(POSTER_BAND.top * h + R);
      expect(pin.y).toBeLessThanOrEqual(POSTER_BAND.bottom * h - R);
    }
    expect(layout.line).toEqual(layout.pins.map((p) => ({ x: p.x, y: p.y })));
    layout.pins.forEach((pin, i) => expect(pin.photo).toBe(stops[i]!.shots[0]!.id));
  });

  it("never zooms past the share cap", () => {
    const stops = stopsOf([photo("a", 10.025, 20.025, 0), photo("b", 10.075, 20.025, 60)]);
    expect(stops).toHaveLength(2);
    const { camera, pins } = posterLayout(stops, [null, null], FILM_CUTS.share);
    expect(camera.zoom).toBeLessThanOrEqual(FILM_CUTS.share.maxZoom - 0.4);
    for (const n of [camera.cx, camera.cy, camera.zoom, ...pins.flatMap((p) => [p.x, p.y])]) expect(Number.isFinite(n)).toBe(true);
  });

  it("stays finite when the stops line up", () => {
    const stops = stopsOf([photo("a", 10.025, 20.025, 0), photo("b", 10.025, 22.5, 60)]);
    expect(stops).toHaveLength(2);
    const { camera, pins } = posterLayout(stops, [null, null], FILM_CUTS.share);
    for (const n of [camera.cx, camera.cy, camera.zoom, ...pins.flatMap((p) => [p.x, p.y])]) expect(Number.isFinite(n)).toBe(true);
    for (const pin of pins) {
      expect(pin.y).toBeGreaterThanOrEqual(POSTER_BAND.top * h + R);
      expect(pin.y).toBeLessThanOrEqual(POSTER_BAND.bottom * h - R);
    }
  });

  it("asks for a bare map of the whole frame", () => {
    const stops = stopsOf([photo("a", 10.1, 20.1, 0), photo("b", 11.2, 21.4, 60)]);
    const { camera, map } = posterLayout(stops, [null, null], FILM_CUTS.share);
    expect(map).toEqual({ cx: camera.cx, cy: camera.cy, zoom: camera.zoom, w: 432, h: 768, labels: false });
  });

  it("names each city once, at its first stop", () => {
    const stops = stopsOf([photo("a", 10.1, 20.1, 0), photo("b", 11.2, 21.4, 60), photo("c", 11.9, 19.2, 120), photo("d", 12.6, 20.3, 180)]);
    expect(stops).toHaveLength(4);
    const { cities } = posterLayout(stops, ["Kotor", "Kotor", null, "Mostar"], FILM_CUTS.share);
    expect(cities).toEqual([
      { text: "Kotor", pin: 0 },
      { text: "Mostar", pin: 3 },
    ]);
  });
});

describe("placeLabels", () => {
  const bounds = { x: 0, y: 0, w: 432, h: 768 };

  it("prefers the right side", () => {
    const out = placeLabels({ pins: [{ x: 100, y: 100 }], pinRadius: 20, cities: [{ pin: 0 }], sizes: [{ w: 60, h: 20 }], bounds, gap: 6 });
    expect(out).toEqual([{ x: 126, y: 90, w: 60, h: 20 }]);
  });

  it("goes left when the right side leaves the bounds", () => {
    const out = placeLabels({ pins: [{ x: 400, y: 100 }], pinRadius: 20, cities: [{ pin: 0 }], sizes: [{ w: 60, h: 20 }], bounds, gap: 6 });
    expect(out[0]!.x).toBe(400 - 20 - 6 - 60);
  });

  it("avoids other pins and other labels", () => {
    const pins = [
      { x: 100, y: 100 },
      { x: 170, y: 100 },
    ];
    const out = placeLabels({ pins, pinRadius: 20, cities: [{ pin: 0 }, { pin: 1 }], sizes: [{ w: 60, h: 20 }, { w: 60, h: 20 }], bounds, gap: 6 });
    const first = out[0]!;
    expect(first.x).not.toBe(126);
    const boxes = out.filter((b): b is LabelBox => b !== null);
    expect(boxes).toHaveLength(2);
    expect(intersects(boxes[0]!, boxes[1]!)).toBe(false);
    for (const box of boxes) for (const pin of pins) expect(hitsCircle(box, pin, 20)).toBe(false);
  });

  it("drops a label with no room", () => {
    const pins = [
      { x: 100, y: 100 },
      { x: 150, y: 100 },
      { x: 50, y: 100 },
      { x: 100, y: 150 },
      { x: 100, y: 50 },
    ];
    const out = placeLabels({
      pins,
      pinRadius: 20,
      cities: [{ pin: 0 }],
      sizes: [{ w: 60, h: 20 }],
      bounds: { x: 20, y: 30, w: 160, h: 140 },
      gap: 6,
    });
    expect(out).toEqual([null]);
  });
});

describe("posterStats", () => {
  it("formats the three numbers", () => {
    expect(posterStats({ days: 24, km: 1858, stops: 9 })).toEqual([
      { value: "24", label: "días" },
      { value: "1.858", label: "km" },
      { value: "9", label: "lugares" },
    ]);
    expect(posterStats({ days: 1, km: 0, stops: 1 }).map((s) => s.label)).toEqual(["día", "km", "lugar"]);
  });
});

describe("posterDates", () => {
  it("adds the year of the end", () => {
    expect(posterDates(Date.UTC(2026, 9, 3, 15), Date.UTC(2026, 9, 26, 15), "America/Argentina/Buenos_Aires")).toBe("3 – 26 de octubre · 2026");
  });
});
