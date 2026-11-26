import { buildStops, buildTimeline, FILM_CUTS, FILM_FRAME, travelZoom, type FilmPhoto } from "../../route";
import type { FrameModel, SceneInput } from "../model";
import { buildScene, frameAt, MAP_CREDIT, printHeight, sceneInput } from "../scene";

const merc = (lng: number, lat: number) => {
  const f = (lat * Math.PI) / 180;
  return { x: (lng + 180) / 360, y: 0.5 - Math.log(Math.tan(Math.PI / 4 + f / 2)) / (2 * Math.PI) };
};
const pts = [merc(15, 42), merc(16, 43), merc(18.5, 44.5), merc(18.8, 45.2), merc(16, 47)];
const shotsN = [1, 2, 3, 4, 1];
const places = ["Alfa", null, "Gamma", "Delta", "Eps"];
const timing = { hookMs: 1800, diveMs: 1400, overviewMs: 1500, dwellMs: 2600, extraPhotoMs: 1800, developMs: 900, cardLeaveMs: 200, pushIn: 0.08, redLight: false };

function makeInput(seed: number, endCardMs = 0): SceneInput {
  const n = pts.length;
  const arrive: number[] = [];
  const leave: number[] = [];
  const depart: number[] = [];
  const move: number[] = [];
  const swaps: number[][] = [];
  let cur = timing.hookMs + timing.diveMs;
  for (let i = 0; i < n; i++) {
    arrive.push(cur);
    const k = shotsN[i]!;
    const dur = timing.dwellMs + timing.extraPhotoMs * (k - 1);
    swaps.push(Array.from({ length: k - 1 }, (_, j) => cur + timing.dwellMs + timing.extraPhotoMs * j));
    leave.push(cur + dur);
    depart.push(cur + dur + timing.cardLeaveMs);
    move.push(i < n - 1 ? 1000 : 0);
    cur = depart[i]! + (i < n - 1 ? 1000 : 0);
  }
  const overviewAt = depart[n - 1]!;
  const hitAt = overviewAt + 1650;
  const authors: SceneInput["authors"] = {};
  pts.forEach((_, i) => {
    for (let j = 0; j < shotsN[i]!; j++) authors[`s${i}-${j}`] = { initial: j % 2 ? "J" : "R", color: "#3155F5", avatar: j === 0 ? "avatar:a" : null };
  });
  return {
    frame: { w: 430, h: 764 },
    seed,
    authors,
    zoom: 7,
    name: "Balcanes",
    hookStats: "5 días",
    closingStats: "5 días · 11 fotos",
    stops: pts.map((p, i) => ({
      x: p.x,
      y: p.y,
      shots: Array.from({ length: shotsN[i]! }, (_, j) => `s${i}-${j}`),
      days: Array.from({ length: shotsN[i]! }, (_, j) => `Día ${i * 4 + j + 1}`),
      place: places[i] ?? null,
    })),
    timeline: { arrive, leave, depart, move, swaps, overviewAt, hitAt, titleAt: hitAt + 400, doneAt: hitAt + 2600 },
    timing: { ...timing, endCardMs },
  };
}

function numbers(v: unknown, path: string, fn: (n: number, path: string) => void) {
  if (typeof v === "number") fn(v, path);
  else if (Array.isArray(v)) v.forEach((x, i) => numbers(x, `${path}[${i}]`, fn));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) numbers(x, `${path}.${k}`, fn);
}

const near = (a: number, b: number, e: number) => Math.abs(a - b) <= e;

const input = makeInput(7);
const scene = buildScene(input);
const tl = input.timeline;
const n = pts.length;
const { w, h } = input.frame;

function expectOverviewOnly(f: FrameModel) {
  expect(f.map.map((m) => [m.layer, m.opacity])).toEqual([[scene.overviewBare, 1], [0, 1]]);
  for (const m of f.map) {
    expect(m.scale).toBeCloseTo(1, 6);
    expect(near(m.x, w / 2, 0.5) && near(m.y, h / 2, 0.5)).toBe(true);
  }
}

describe("scene", () => {
  it("has both a pan and a dip in the test trip", () => {
    expect(scene.hops).toContain("pan");
    expect(scene.hops).toContain("dip");
  });

  it("keeps every value finite and in range across the film", () => {
    let prevLine = 0;
    for (let t = -500; t <= tl.doneAt + 500; t += 20) {
      const f = frameAt(scene, t);
      numbers(f, `frame@${t}`, (v, p) => {
        if (!Number.isFinite(v)) throw new Error(`non-finite ${p}`);
      });
      for (const m of f.map) expect(m.opacity >= 0 && m.opacity <= 1).toBe(true);
      expect(f.map[0]!.layer).toBe(scene.overviewBare);
      expect(f.map[0]!.opacity).toBe(1);
      for (const wl of f.warm) expect(Number.isInteger(wl) && wl >= 0 && wl < scene.layers.length).toBe(true);
      for (const v of [f.light, f.flash, f.hook.opacity, f.closing.opacity, f.title ? f.title.opacity : 0, f.credit.opacity]) expect(v >= 0 && v <= 1).toBe(true);
      for (const p of f.prints) expect(p.opacity >= 0 && p.opacity <= 1).toBe(true);
      expect(f.line.length).toBeGreaterThanOrEqual(prevLine);
      prevLine = f.line.length;
    }
  });

  it("rests on each stop's image, pin at the anchor", () => {
    for (let i = 0; i < n; i++) {
      const f = frameAt(scene, (tl.arrive[i]! + tl.leave[i]!) / 2);
      const pin = f.pins.find((p) => p.stop === i);
      expect(pin?.current).toBe(true);
      expect(near(pin!.x, scene.anchor.x, 0.5) && near(pin!.y, scene.anchor.y, 0.5)).toBe(true);
      const top = f.map[f.map.length - 1]!;
      expect(top.layer).toBe(i + 1);
      expect(top.opacity).toBe(1);
      expect(top.scale).toBeCloseTo(1, 6);
      expect(near(top.x, w / 2, 0.5) && near(top.y, h / 2, 0.5)).toBe(true);
    }
  });

  it("rests a dip on its hop view, or on the overview when there is none", () => {
    scene.hops.forEach((k, i) => {
      if (k === "pan") {
        expect(scene.hopViews[i]).toBeNull();
        return;
      }
      const f = frameAt(scene, tl.depart[i]! + tl.move[i]! / 2);
      const view = scene.hopViews[i];
      if (!view) return expectOverviewOnly(f);
      const top = f.map[f.map.length - 1]!;
      expect(top.layer).toBe(view.layer);
      expect(top.opacity).toBe(1);
      expect(top.scale).toBeCloseTo(1, 6);
      expect(near(top.x, w / 2, 0.5) && near(top.y, h / 2, 0.5)).toBe(true);
    });
  });

  it("ends on the overview with the whole route drawn", () => {
    const f = frameAt(scene, tl.doneAt);
    expectOverviewOnly(f);
    expect(f.line).toHaveLength(n);
    expect(f.light).toBe(0);
    expect(f.closing.opacity).toBe(1);
    expect(f.pins).toHaveLength(n);
    expect(f.pins.every((p) => near(p.scale, 1, 1e-6))).toBe(true);
  });

  it("picks deterministic layouts among the candidates, never the same twice in a row", () => {
    const cands: Record<number, string[]> = { 1: ["print", "big"], 2: ["pair", "print", "big"], 3: ["trio", "print", "big"], 4: ["grid", "print", "big"] };
    const seen = new Set<string>();
    for (let s = 1; s <= 20; s++) {
      const a = buildScene(makeInput(s));
      const b = buildScene(makeInput(s));
      expect(a.layouts).toEqual(b.layouts);
      expect(a.lean).toEqual(b.lean);
      a.layouts.forEach((l, i) => {
        expect(cands[shotsN[i]!]).toContain(l);
        if (i > 0) expect(l).not.toBe(a.layouts[i - 1]);
      });
      seen.add(a.layouts.join(","));
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it("shows the right prints inside the frame, none during a hop", () => {
    const kinds = new Set<string>();
    for (let s = 1; s <= 20; s++) {
      const sc = buildScene(makeInput(s));
      for (let i = 0; i < n; i++) {
        const f = frameAt(sc, tl.leave[i]! - 400);
        const lay = sc.layouts[i]!;
        kinds.add(lay);
        expect(f.prints).toHaveLength(lay === "pair" ? 2 : lay === "trio" ? 3 : 1);
        if (lay === "grid") {
          expect(f.prints[0]!.photos).toHaveLength(4);
          expect(f.prints[0]!.photos.every((p) => p.develop >= 0)).toBe(true);
        } else expect(f.prints.every((p) => p.photos.length === 1)).toBe(true);
        for (const p of f.prints) expect(p.x - p.width / 2 >= 0 && p.x + p.width / 2 <= w).toBe(true);
        if (i < n - 1) expect(frameAt(sc, tl.depart[i]! + tl.move[i]! / 2).prints).toHaveLength(0);
      }
    }
    expect(kinds).toEqual(new Set(["print", "big", "pair", "trio", "grid"]));
    expect(printHeight(100)).toBeGreaterThan(100);
  });

  it("puts the on-the-pin print at half the frame's width", () => {
    for (let s = 1; s <= 20; s++) {
      const sc = buildScene(makeInput(s));
      const i = sc.layouts.indexOf("print");
      if (i < 0) continue;
      const f = frameAt(sc, tl.leave[i]! - 400);
      expect(f.prints[0]!.width).toBe(0.5 * w);
      return;
    }
    throw new Error("no seed gave a print layout");
  });

  it("indexes day and place texts for every shot", () => {
    for (let s = 1; s <= 5; s++) {
      const sc = buildScene(makeInput(s));
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < shotsN[i]!; j++) {
          const t = j === 0 ? tl.arrive[i]! + 400 : tl.swaps[i]![j - 1]! + 100;
          const f = frameAt(sc, t);
          expect(f.title).not.toBeNull();
          const d = sc.texts[f.title!.day]!;
          expect(d).toEqual({ role: "day", text: `Día ${i * 4 + j + 1}` });
          if (places[i]) expect(sc.texts[f.title!.place]).toEqual({ role: "place", text: places[i] });
          else expect(f.title!.place).toBe(-1);
        }
      }
    }
    expect(scene.texts[0]!.role).toBe("hookName");
    expect(scene.texts[2]!.text).toBe("SE REVELÓ");
    expect(scene.texts[4]!.role).toBe("closingStats");
  });

  it("has no end card without endCardMs", () => {
    const reveal = buildScene(makeInput(7));
    expect(reveal.durationMs).toBe(reveal.input.timeline.doneAt);
    for (let t = 0; t <= reveal.durationMs; t += 100) {
      const f = frameAt(reveal, t);
      expect(f.endCard.opacity).toBe(0);
      expect(f.endCard.name).toBe(-1);
      expect(f.credit.opacity).toBe(1);
    }
    expect(reveal.texts.some((x) => x.role === "endName")).toBe(false);
  });

  it("fades in the end card after doneAt and the credit out with it", () => {
    const long = buildScene(makeInput(7, 2500));
    const ltl = long.input.timeline;
    expect(long.durationMs).toBe(ltl.doneAt + 2500);
    for (let t = 0; t <= ltl.doneAt; t += 50) {
      expect(frameAt(long, t).endCard.opacity).toBe(0);
      expect(frameAt(long, t).credit.opacity).toBe(1);
    }
    const mid = frameAt(long, ltl.doneAt + 200);
    expect(mid.endCard.opacity).toBeGreaterThan(0);
    expect(mid.endCard.opacity).toBeLessThan(1);
    expect(mid.credit.opacity).toBeCloseTo(1 - mid.endCard.opacity, 9);
    for (let t = ltl.doneAt + 400; t <= long.durationMs; t += 50) expect(frameAt(long, t).endCard.opacity).toBe(1);
    const end = frameAt(long, long.durationMs);
    expect(end.credit.opacity).toBe(0);
    expect(long.texts[end.credit.text]).toEqual({ text: MAP_CREDIT, role: "credit" });
    const ec = end.endCard;
    expect(long.texts[ec.name]!.text).toBe("Rollo Project");
    expect(long.texts[ec.badgeSmall]!.text).toBe("Consíguelo en el");
    expect(long.texts[ec.badgeBig]!.text).toBe("App Store");
    for (const id of Object.keys(long.input.authors)) {
      const text = long.texts[long.authorTexts[id]!]!;
      expect(text.role).toBe("initial");
      expect(text.text).toBe(long.input.authors[id]!.initial);
    }
    expect(long.texts[frameAt(long, ltl.arrive[1]! + 400).title!.day]!.role).toBe("day");
  });
});

// A random trip the way the app builds one.
function randomPhotos(rnd: () => number): FilmPhoto[] {
  const placesN = 2 + Math.floor(rnd() * 18);
  const spread = 0.5 + rnd() * 25;
  const out: FilmPhoto[] = [];
  let ts = Date.UTC(2026, 5, 1);
  const count = 30 + Math.floor(rnd() * 120);
  for (let k = 0; k < count; k++) {
    const pl = Math.floor((k * placesN) / 60) % placesN;
    ts += Math.floor(rnd() * 3_600_000);
    out.push({
      id: `p${k}`,
      authorId: `a${Math.floor(rnd() * 3)}`,
      authorName: "A",
      authorAvatar: null,
      lat: 40 + (pl * spread) / placesN + rnd() * 0.01,
      lng: 10 + (((pl * 7) % placesN) * spread) / placesN + rnd() * 0.01,
      takenAt: ts,
      day: new Date(ts).toISOString().slice(0, 10),
      likeCount: 0,
      thumb: { uri: "" },
      display: { uri: "" },
    });
  }
  return out;
}

describe("film length", () => {
  it("never passes 59 s, end card included, in either cut", () => {
    let seed = 12345;
    const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    for (const cut of [FILM_CUTS.reveal, FILM_CUTS.share]) {
      for (let trial = 0; trial < 300; trial++) {
        const photos = randomPhotos(rnd);
        const stops = buildStops(photos, cut, photos[0]!.day);
        if (stops.length < 2) continue;
        const timeline = buildTimeline(stops, travelZoom(stops, FILM_FRAME.w, cut), FILM_FRAME.w, cut);
        expect(timeline.doneAt + cut.endCardMs).toBeLessThanOrEqual(59_000);
      }
    }
  });
});

function tripPhotos(): FilmPhoto[] {
  const base = Date.UTC(2026, 6, 1);
  const spots: [number, number][] = [[41, 12], [43, 14], [45, 16]];
  return spots.flatMap(([lat, lng], i) =>
    [0, 1].map((k) => ({
      id: `p${i}-${k}`,
      authorId: k ? "u2" : "u1",
      authorName: k ? "" : "ana",
      authorAvatar: k ? null : { uri: "https://x/a.jpg" },
      lat,
      lng,
      takenAt: base + (i * 2 + k) * 3_600_000,
      day: "2026-07-01",
      likeCount: 0,
      thumb: { uri: "t" },
      display: { uri: "d" },
    })),
  );
}

describe("sceneInput", () => {
  const stops = buildStops(tripPhotos(), FILM_CUTS.share, "2026-07-01");
  const args = { name: "Italia", stops, places: ["Roma", null, "Bolonia"], cut: FILM_CUTS.share, seed: 3, colorOf: (id: string) => `c-${id}` };

  it("writes the stats with singulars and thousands dots", () => {
    expect(sceneInput({ ...args, days: 1, km: 3, photos: 1 }).hookStats).toBe("1 día · 3 km");
    expect(sceneInput({ ...args, days: 1, km: 3, photos: 1 }).closingStats).toBe("1 día · 3 km · 1 foto");
    expect(sceneInput({ ...args, days: 24, km: 1858, photos: 11 }).closingStats).toBe("24 días · 1.858 km · 11 fotos");
  });

  it("takes the initial from the first code point, not half a surrogate pair", () => {
    const emoji = buildStops(tripPhotos().map((p) => (p.authorId === "u1" ? { ...p, authorName: "  \u{1F334}ana" } : p)), FILM_CUTS.share, "2026-07-01");
    const si = sceneInput({ ...args, stops: emoji, days: 2, km: 10, photos: 6 });
    expect(si.authors[emoji[0]!.shots[0]!.id]!.initial).toBe("\u{1F334}");
  });

  it("fills authors, stops and timing from the stops and the cut", () => {
    const si = sceneInput({ ...args, days: 2, km: 10, photos: 6 });
    expect(si.frame).toEqual(FILM_FRAME);
    expect(si.authors[stops[0]!.shots[0]!.id]).toEqual({ initial: "A", color: "c-u1", avatar: "avatar:u1" });
    const other = Object.values(si.authors).find((a) => a.color === "c-u2");
    expect(other).toEqual({ initial: "?", color: "c-u2", avatar: null });
    expect(si.stops.map((s) => s.place)).toEqual(["Roma", null, "Bolonia"]);
    expect(si.stops[0]!.days).toEqual(["Día 1", "Día 1"]);
    expect(si.timing.endCardMs).toBe(2500);
    expect(si.timing.redLight).toBe(false);
    expect(si.timing.dwellMs).toBe(2600);
  });

  describe("share cut scene", () => {
    const si = sceneInput({ ...args, days: 2, km: 10, photos: 6 });
    const sc = buildScene(si);
    const doneAt = si.timeline.doneAt;

    it("lasts doneAt + 2500 and fades the end card in 400 ms", () => {
      expect(sc.durationMs).toBe(doneAt + 2500);
      expect(frameAt(sc, doneAt).endCard.opacity).toBe(0);
      expect(frameAt(sc, doneAt + 400).endCard.opacity).toBe(1);
    });

    it("shows the credit until doneAt and not at the end", () => {
      expect(frameAt(sc, doneAt - 1).credit.opacity).toBe(1);
      expect(frameAt(sc, 0).credit.opacity).toBe(1);
      expect(frameAt(sc, sc.durationMs).credit.opacity).toBe(0);
    });
  });

  describe("reveal cut scene", () => {
    const rstops = buildStops(tripPhotos(), FILM_CUTS.reveal, "2026-07-01");
    const si = sceneInput({ ...args, stops: rstops, cut: FILM_CUTS.reveal, days: 2, km: 10, photos: 3 });
    const sc = buildScene(si);

    it("has no end card and ends at doneAt", () => {
      expect(sc.durationMs).toBe(si.timeline.doneAt);
      for (let t = 0; t <= sc.durationMs; t += 100) {
        expect(frameAt(sc, t).endCard.opacity).toBe(0);
        expect(frameAt(sc, t).credit.opacity).toBe(1);
      }
    });
  });
});
