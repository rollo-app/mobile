// The trip film engine, pure scene: `buildScene` lays the film out once, `frameAt` says what is on the frame at time t.
// Pure: no Skia, no React (it imports only types from the contract and values from the pure `../route`).
import { buildTimeline, FILM_FRAME, shotTitle, toMercator, travelZoom, type FilmCut, type Stop } from "../route";
import type { FrameModel, LayoutKind, Pt, PrintModel, PrintPhoto, Scene, SceneInput, SceneText } from "./model";

/** The map credit every frame with a map carries. */
export const MAP_CREDIT = "© OpenStreetMap · OpenFreeMap";
/** Index in `scene.texts` of the map credit, right after the four fixed ones; the day titles start after it. */
const CREDIT_TEXT = 5;

/** Paper shape shared by the scene (to place prints) and the renderer (to paint them), as fractions of the print's width. */
export const PAPER = {
  /** White border at the top and the sides. */
  border: 0.035,
  /** White border at the bottom (the wider one of an instant print). */
  bottom: 0.105,
  /** Photo window: width / height. */
  ratio: 3 / 4,
  /** Gap between the cells of a grid print. */
  gap: 0.02,
} as const;

/** Height of a print of width `w` (a grid print has the same outer shape). */
export function printHeight(w: number): number {
  "worklet";
  const photoW = w * (1 - 2 * PAPER.border);
  return w * PAPER.border + photoW / PAPER.ratio + w * PAPER.bottom;
}

const ANCHOR_Y = 0.7;
/** A stop's image when the camera slides to or from it: a frame plus 0.4 on every side, enough for the longest slide. */
const COVER = 1.8;
/** A stop the camera only zooms into and out of needs much less (and these images are most of the memory). */
const COVER_NARROW = 1.35;
/** The overview is underneath everything, wherever the camera goes while far out: wide enough to never run out. */
const OVERVIEW_COVER = 2;
/** A hop's own view: a frame and a bit, at the zoom where both of its stops fit. */
const HOP_COVER = 1.4;
const PAN_MAX = 0.7;
const DIP_EDGE = 0.32;
const PIN_POP_MS = 350;
/** A map image fades out over this share of the frame's width as its edge nears the frame, so an edge never shows. */
const EDGE_FADE = 0.1;
/**
 * When the next move's images are named in `warm`: this long after the stop's first photo is sharp, and the second one
 * this much later (never past a set share of the time that photo sits still, so a short stay warms them too).
 */
const WARM_AFTER_MS = 250;
const WARM_GAP_MS = 300;
/** The overview's place names fade out between these magnifications: at rest they read, magnified they would swell. */
const NAMES_FROM = 1.08;
const NAMES_GONE = 1.4;
/** The end card fades from the film to black over this long, from `doneAt`. */
const END_FADE_MS = 400;

type Cam = { cx: number; cy: number; zoom: number };
type Phase = 0 | 1 | 2 | 3 | 4;
type Where = { phase: Phase; i: number; u: number; cam: Cam };

function clamp01(x: number): number {
  "worklet";
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function lerp(a: number, b: number, u: number): number {
  "worklet";
  return a + (b - a) * u;
}

function easeInOut(u: number): number {
  "worklet";
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

function easeOutBack(u: number): number {
  "worklet";
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const m = u - 1;
  return 1 + c3 * m * m * m + c1 * m * m;
}

function easeInQuad(u: number): number {
  "worklet";
  return u * u;
}

function smoothstep(e0: number, e1: number, x: number): number {
  "worklet";
  if (e1 <= e0) return x >= e1 ? 1 : 0;
  const u = clamp01((x - e0) / (e1 - e0));
  return u * u * (3 - 2 * u);
}

function worldW(z: number): number {
  "worklet";
  return 512 * Math.pow(2, z);
}

function project(scene: Scene, cam: Cam, px: number, py: number): Pt {
  "worklet";
  const { w, h } = scene.input.frame;
  const s = worldW(cam.zoom);
  return { x: w / 2 + (px - cam.cx) * s, y: h / 2 + (py - cam.cy) * s };
}

function focus(scene: Scene, px: number, py: number, qx: number, qy: number, z: number): Cam {
  "worklet";
  const { w, h } = scene.input.frame;
  const s = worldW(z);
  return { cx: px - (qx - w / 2) / s, cy: py - (qy - h / 2) / s, zoom: z };
}

function camStop(scene: Scene, i: number): Cam {
  "worklet";
  const st = scene.input.stops[i]!;
  return focus(scene, st.x, st.y, scene.anchor.x, scene.anchor.y, scene.input.zoom);
}

function ovPos(scene: Scene, i: number): Pt {
  "worklet";
  const st = scene.input.stops[i]!;
  return project(scene, scene.overview, st.x, st.y);
}

/** Index in `scene.texts` of the first day title of stop `i` (its place entry is that plus its number of shots). */
function dayBase(scene: Scene, i: number): number {
  "worklet";
  const stops = scene.input.stops;
  let base = CREDIT_TEXT + 1;
  for (let k = 0; k < i; k++) base += stops[k]!.shots.length + 1;
  return base;
}

function locate(scene: Scene, t: number): Where {
  "worklet";
  const input = scene.input;
  const tl = input.timeline;
  const ti = input.timing;
  const n = input.stops.length;
  const Z = input.zoom;
  const zo = scene.overview.zoom;
  const a = DIP_EDGE;
  if (t >= tl.overviewAt) {
    const u = easeInOut(clamp01(ti.overviewMs > 0 ? (t - tl.overviewAt) / ti.overviewMs : 1));
    const st = input.stops[n - 1]!;
    const p = ovPos(scene, n - 1);
    const q = { x: lerp(scene.anchor.x, p.x, u), y: lerp(scene.anchor.y, p.y, u) };
    return { phase: 4, i: n - 1, u, cam: focus(scene, st.x, st.y, q.x, q.y, lerp(Z, zo, u)) };
  }
  if (t < ti.hookMs) {
    const u = clamp01(ti.hookMs > 0 ? t / ti.hookMs : 1);
    return { phase: 0, i: 0, u, cam: { cx: scene.overview.cx, cy: scene.overview.cy, zoom: zo + 0.06 * u } };
  }
  if (t < tl.arrive[0]!) {
    const span = tl.arrive[0]! - ti.hookMs;
    const u = easeInOut(clamp01(span > 0 ? (t - ti.hookMs) / span : 1));
    const st = input.stops[0]!;
    const p = ovPos(scene, 0);
    const q = { x: lerp(p.x, scene.anchor.x, u), y: lerp(p.y, scene.anchor.y, u) };
    return { phase: 1, i: 0, u, cam: focus(scene, st.x, st.y, q.x, q.y, lerp(zo + 0.06, Z, u)) };
  }
  for (let i = 0; i < n; i++) {
    if (t < tl.arrive[i]! && i > 0) {
      const j = i - 1;
      const mv = tl.move[j]!;
      const u = clamp01(mv > 0 ? (t - tl.depart[j]!) / mv : 1);
      const s0 = input.stops[j]!;
      const s1 = input.stops[j + 1]!;
      if (scene.hops[j]! === "pan") {
        const e = easeInOut(u);
        const c0 = camStop(scene, j);
        const c1 = camStop(scene, j + 1);
        return { phase: 3, i: j, u, cam: { cx: lerp(c0.cx, c1.cx, e), cy: lerp(c0.cy, c1.cy, e), zoom: Z } };
      }
      // A dip pulls out to the view that holds both stops (the overview itself when they are that far apart), waits
      // there while the line crosses, and goes back in. Each end zooms about its own stop, so the stop never jumps.
      const view: Cam = scene.hopViews[j] ?? scene.overview;
      if (u < a) {
        const e = easeInOut(u / a);
        const p = project(scene, view, s0.x, s0.y);
        return { phase: 3, i: j, u, cam: focus(scene, s0.x, s0.y, lerp(scene.anchor.x, p.x, e), lerp(scene.anchor.y, p.y, e), lerp(Z, view.zoom, e)) };
      }
      if (u <= 1 - a) {
        return { phase: 3, i: j, u, cam: { cx: view.cx, cy: view.cy, zoom: view.zoom } };
      }
      const e = easeInOut((u - (1 - a)) / a);
      const p = project(scene, view, s1.x, s1.y);
      return { phase: 3, i: j, u, cam: focus(scene, s1.x, s1.y, lerp(p.x, scene.anchor.x, e), lerp(p.y, scene.anchor.y, e), lerp(view.zoom, Z, e)) };
    }
    if (t < tl.depart[i]!) return { phase: 2, i, u: 0, cam: camStop(scene, i) };
  }
  return { phase: 2, i: n - 1, u: 0, cam: camStop(scene, n - 1) };
}

function mapEntry(scene: Scene, cam: Cam, layer: number, opacity: number) {
  "worklet";
  const { w, h } = scene.input.frame;
  const L = scene.layers[layer]!;
  const s = worldW(cam.zoom);
  return { layer, x: w / 2 + (L.cx - cam.cx) * s, y: h / 2 + (L.cy - cam.cy) * s, scale: Math.pow(2, cam.zoom - L.zoom), opacity };
}

/** How far the image's nearest edge is beyond the frame's (negative: one of its edges is inside the frame). */
function beyond(scene: Scene, m: { layer: number; x: number; y: number; scale: number }): number {
  "worklet";
  const { w, h } = scene.input.frame;
  const L = scene.layers[m.layer]!;
  const hw = (L.w * m.scale) / 2;
  const hh = (L.h * m.scale) / 2;
  return Math.min(hw - m.x, m.x + hw - w, hh - m.y, m.y + hh - h);
}

/**
 * An image that is only shown while it covers the whole frame: its opacity is how far its nearest edge is beyond the
 * frame's, so it is gone exactly when that edge would come into view.
 */
function covering(scene: Scene, cam: Cam, layer: number) {
  "worklet";
  const m = mapEntry(scene, cam, layer, 1);
  m.opacity = smoothstep(0, EDGE_FADE * scene.input.frame.w, beyond(scene, m));
  return m;
}

function buildPrint(
  scene: Scene,
  x0: number,
  y0: number,
  width: number,
  r0: number,
  tauE: number,
  q: number,
  photos: PrintPhoto[],
): PrintModel {
  "worklet";
  const { h } = scene.input.frame;
  const pop = easeOutBack(clamp01(tauE / 380));
  const fade = clamp01(tauE / 160);
  return {
    x: lerp(x0, scene.anchor.x, 0.6 * q),
    y: lerp(y0 + (1 - pop) * 0.08 * h, scene.anchor.y, 0.6 * q),
    width,
    rotation: r0 * pop,
    scale: (0.6 + 0.4 * pop) * (1 - 0.5 * q),
    opacity: fade * (1 - q),
    photos,
  };
}

function photoAt(scene: Scene, id: string, tauP: number, hold: number): PrintPhoto {
  "worklet";
  const ti = scene.input.timing;
  const develop = clamp01(ti.developMs > 0 ? (tauP - 100) / ti.developMs : 1);
  const zoomIn = 1 + ti.pushIn * clamp01(hold > 0 ? tauP / hold : 1);
  return { photo: id, develop, zoomIn };
}

function printsAt(scene: Scene, i: number, t: number, j: number): PrintModel[] {
  "worklet";
  const { w, h } = scene.input.frame;
  const input = scene.input;
  const tl = input.timeline;
  const ti = input.timing;
  const shots = input.stops[i]!.shots;
  const last = shots.length - 1;
  const arrive = tl.arrive[i]!;
  const swaps = tl.swaps[i]!;
  const tau = t - arrive;
  const L = tl.leave[i]! - arrive;
  const lc = ti.cardLeaveMs;
  const q = easeInQuad(clamp01(lc > 0 ? (tau - L) / lc : tau >= L ? 1 : 0));
  const l = scene.lean[i]!;
  const layout = scene.layouts[i]!;
  const out: PrintModel[] = [];
  const entry = (k: number): number => {
    "worklet";
    return k === 0 ? 0 : swaps[k - 1]! - arrive;
  };
  const id = (k: number): string => {
    "worklet";
    return shots[k > last ? last : k]!;
  };

  if (layout === "print" || layout === "big") {
    const jj = j > last ? last : j;
    const tauP = tau - entry(jj);
    const photo = photoAt(scene, id(jj), tauP, jj === 0 ? ti.dwellMs : ti.extraPhotoMs);
    if (layout === "print") {
      // Sits on the pin, as wide as fits between the title and it: the map stays in view around it.
      const width = 0.5 * w;
      out.push(buildPrint(scene, w / 2, scene.anchor.y - 0.088 * h - printHeight(width) / 2, width, 2.4 * l, tau, q, [photo]));
    } else {
      // Takes the frame, pin included: the photo is the whole moment.
      out.push(buildPrint(scene, w / 2, 0.535 * h, 0.76 * w, 1 * l, tau, q, [photo]));
    }
    return out;
  }
  if (layout === "grid") {
    const photos: PrintPhoto[] = [];
    const cells = last + 1 < 4 ? last + 1 : 4;
    for (let k = 0; k < cells; k++) {
      const ek = entry(k);
      const develop = tau < ek ? -1 : clamp01(ti.developMs > 0 ? (tau - ek - 100) / ti.developMs : 1);
      photos.push({ photo: id(k), develop, zoomIn: 1 });
    }
    out.push(buildPrint(scene, w / 2, 0.55 * h, 0.8 * w, 1.2 * l, tau, q, photos));
    return out;
  }
  const count = layout === "pair" ? 2 : 3;
  // Until the second print arrives the first one has the middle to itself, a little larger; then it steps aside.
  const aside = last >= 1 ? easeInOut(clamp01((tau - entry(1)) / 420)) : 0;
  for (let k = 0; k < count; k++) {
    const ek = entry(k);
    if (tau < ek) continue;
    const photo = photoAt(scene, id(k), tau - ek, L - ek);
    let width: number;
    let x0: number;
    let y0: number;
    let r0: number;
    if (layout === "pair") {
      // Side by side, the second a step lower and just over the first one's edge.
      width = 0.47 * w;
      x0 = w / 2 + (k === 0 ? -0.2 : 0.2) * w * l;
      y0 = (k === 0 ? 0.432 : 0.47) * h;
      r0 = (k === 0 ? -4 : 3.5) * l;
    } else {
      // Two side by side and the third, centred, over their lower corners.
      width = 0.45 * w;
      x0 = w / 2 + (k === 0 ? -0.205 : k === 1 ? 0.205 : 0) * w * l;
      y0 = (k === 0 ? 0.415 : k === 1 ? 0.43 : 0.635) * h;
      r0 = (k === 0 ? -5 : k === 1 ? 4 : -1.5) * l;
    }
    if (k === 0) {
      width = lerp(0.5 * w, width, aside);
      x0 = lerp(w / 2, x0, aside);
      y0 = lerp(0.425 * h, y0, aside);
      r0 = lerp(-1.5 * l, r0, aside);
    }
    out.push(buildPrint(scene, x0, y0, width, r0, tau - ek, q, [photo]));
  }
  return out;
}

function mulberry32(seed: number): () => number {
  // The seed is scrambled first: this generator's first values for neighbouring seeds (1, 2, 3…) come out close, and
  // the film of seed 2 would be the film of seed 1.
  let a = seed >>> 0;
  a ^= a >>> 16;
  a = Math.imul(a, 0x85ebca6b);
  a ^= a >>> 13;
  a = Math.imul(a, 0xc2b2ae35);
  a ^= a >>> 16;
  a >>>= 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildScene(input: SceneInput): Scene {
  const { w, h } = input.frame;
  const Z = input.zoom;
  const stops = input.stops;
  const n = stops.length;
  const W = (z: number): number => 512 * Math.pow(2, z);
  const anchor = { x: w / 2, y: h * ANCHOR_Y };

  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const s of stops) {
    if (s.x < x0) x0 = s.x;
    if (s.x > x1) x1 = s.x;
    if (s.y < y0) y0 = s.y;
    if (s.y > y1) y1 = s.y;
  }
  if (n === 0) {
    x0 = x1 = y0 = y1 = 0.5;
  }
  if (x1 - x0 < 1e-9) {
    const m = (x0 + x1) / 2;
    x0 = m - 5e-10;
    x1 = m + 5e-10;
  }
  if (y1 - y0 < 1e-9) {
    const m = (y0 + y1) / 2;
    y0 = m - 5e-10;
    y1 = m + 5e-10;
  }
  const zo = Math.min(Z - 0.4, Math.log2(Math.min((0.76 * w) / (512 * (x1 - x0)), (0.54 * h) / (512 * (y1 - y0)))));
  const bx = (x0 + x1) / 2;
  const by = (y0 + y1) / 2;
  const overview = { cx: bx - (0.5 * w - w / 2) / W(zo), cy: by - (0.59 * h - h / 2) / W(zo), zoom: zo };

  const layers: Scene["layers"] = [{ cx: overview.cx, cy: overview.cy, zoom: zo, w: OVERVIEW_COVER * w, h: OVERVIEW_COVER * h, labels: true }];
  const slides = (i: number): boolean => {
    if (i < 0 || i + 1 >= n) return false;
    const dx = (Math.abs(stops[i + 1]!.x - stops[i]!.x) * W(Z)) / w;
    const dy = (Math.abs(stops[i + 1]!.y - stops[i]!.y) * W(Z)) / h;
    return dx <= PAN_MAX && dy <= PAN_MAX;
  };
  for (let i = 0; i < n; i++) {
    const cover = slides(i - 1) || slides(i) ? COVER : COVER_NARROW;
    layers.push({
      cx: stops[i]!.x - (anchor.x - w / 2) / W(Z),
      cy: stops[i]!.y - (anchor.y - h / 2) / W(Z),
      zoom: Z,
      w: cover * w,
      h: cover * h,
      labels: true,
    });
  }

  const hops: ("pan" | "dip")[] = [];
  const hopViews: Scene["hopViews"] = [];
  for (let i = 0; i + 1 < n; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    const dx = (Math.abs(b.x - a.x) * W(Z)) / w;
    const dy = (Math.abs(b.y - a.y) * W(Z)) / h;
    if (slides(i)) {
      hops.push("pan");
      hopViews.push(null);
      continue;
    }
    hops.push("dip");
    // Only as far out as it takes for both stops to sit comfortably in the frame (half its width apart, or 0.42 of its
    // height): going out to the whole route for every hop is dizzying. Almost at the overview already: use it.
    const zh = Z - Math.log2(Math.max(dx / 0.5, dy / 0.42, 1));
    if (zh <= zo + 0.25) {
      hopViews.push(null);
      continue;
    }
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const view = { cx: mx - (0.5 * w - w / 2) / W(zh), cy: my - (0.56 * h - h / 2) / W(zh), zoom: zh };
    hopViews.push({ ...view, layer: layers.length });
    layers.push({ cx: view.cx, cy: view.cy, zoom: zh, w: HOP_COVER * w, h: HOP_COVER * h, labels: false });
  }
  const overviewBare = layers.length;
  layers.push({ ...layers[0]!, labels: false });

  const rng = mulberry32(input.seed >>> 0);
  const layouts: LayoutKind[] = [];
  const lean: number[] = [];
  for (let i = 0; i < n; i++) {
    const k = Math.min(Math.max(stops[i]!.shots.length, 1), 4);
    // One shot: a print on the pin, or a large one. Several: all of them at once in a collage (twice as likely: it is
    // the framing only they can have), or taking turns on one print. Never the same as the stop before.
    const collage: LayoutKind | null = k === 2 ? "pair" : k === 3 ? "trio" : k === 4 ? "grid" : null;
    const cand: LayoutKind[] = collage ? [collage, collage, "print", "big"] : ["print", "big"];
    const options = i > 0 ? cand.filter((c) => c !== layouts[i - 1]) : cand;
    layouts.push(options[Math.floor(rng() * options.length)]!);
    lean.push(rng() < 0.5 ? -1 : 1);
  }

  const texts: SceneText[] = [
    { text: input.name, role: "hookName" },
    { text: input.hookStats, role: "hookStats" },
    { text: "SE REVELÓ", role: "kicker" },
    { text: input.name, role: "closingName" },
    { text: input.closingStats, role: "closingStats" },
    { text: MAP_CREDIT, role: "credit" },
  ];
  for (const s of stops) {
    for (let j = 0; j < s.shots.length; j++) texts.push({ text: s.days[j] ?? "", role: "day" });
    texts.push({ text: s.place ?? "", role: "place" });
  }

  if (input.timing.endCardMs > 0) {
    texts.push({ text: "Rollo Project", role: "endName" });
    texts.push({ text: "Consíguelo en el", role: "badgeSmall" });
    texts.push({ text: "App Store", role: "badgeBig" });
  }
  // One entry per distinct initial, shared by every photo of those authors.
  const authorTexts: Record<string, number> = {};
  const initialAt: Record<string, number> = {};
  for (const id of Object.keys(input.authors)) {
    const initial = input.authors[id]!.initial;
    if (initialAt[initial] === undefined) {
      initialAt[initial] = texts.length;
      texts.push({ text: initial, role: "initial" });
    }
    authorTexts[id] = initialAt[initial]!;
  }

  return { input, anchor, overview, layers, overviewBare, hops, hopViews, layouts, lean, texts, authorTexts, durationMs: input.timeline.doneAt + input.timing.endCardMs };
}

export function frameAt(scene: Scene, t: number): FrameModel {
  "worklet";
  const input = scene.input;
  const tl = input.timeline;
  const ti = input.timing;
  const n = input.stops.length;
  const a = DIP_EDGE;
  const loc = locate(scene, t);
  const cam = loc.cam;
  const ph = loc.phase;

  // Map. The overview without names is always underneath. Over it go the closer images (the stop's, a hop's own view),
  // each one only while it covers the whole frame (`covering`): one rule for every move (zooming in or out, sliding),
  // no seams. The overview's names go between the two, while it is seen close to its own size and nothing hides it.
  const over = [];
  if (ph === 1) over.push(covering(scene, cam, 1));
  else if (ph === 2) over.push(covering(scene, cam, loc.i + 1));
  else if (ph === 3) {
    if (scene.hops[loc.i]! === "pan") {
      // The stop we leave stays whole underneath: a pan is short enough for the next stop's image to cover the frame
      // before this one stops doing so, and that way the far-out overview never shows through the dissolve.
      over.push(mapEntry(scene, cam, loc.i + 1, 1));
      over.push(covering(scene, cam, loc.i + 2));
    } else {
      const view = scene.hopViews[loc.i];
      if (view) over.push(covering(scene, cam, view.layer));
      over.push(covering(scene, cam, loc.i + 1));
      over.push(covering(scene, cam, loc.i + 2));
    }
  } else if (ph === 4) over.push(covering(scene, cam, n));

  const map = [mapEntry(scene, cam, scene.overviewBare, 1)];
  const named = mapEntry(scene, cam, 0, 1);
  named.opacity = 1 - smoothstep(NAMES_FROM, NAMES_GONE, named.scale);
  let hidden = false;
  for (const m of over) if (m.opacity >= 1 && beyond(scene, m) >= 0) hidden = true;
  if (named.opacity > 0 && !hidden) map.push(named);
  for (const m of over) if (m.opacity > 0) map.push(m);

  // What the next move shows, ahead of it. Before the first stop: its image (the cover is still up at 0). On a stop,
  // once its first photo is sharp and nothing moves: the next stop's image, then the view of the hop that leads there.
  const warm: number[] = [];
  if (ph <= 1) warm.push(1);
  else if (ph === 2) {
    const firstSwap = tl.swaps[loc.i]![0];
    const from = tl.arrive[loc.i]! + 100 + ti.developMs;
    const until = firstSwap !== undefined ? firstSwap : tl.leave[loc.i]!;
    const room = until > from ? until - from : 0;
    const first = t >= from + Math.min(WARM_AFTER_MS, 0.25 * room);
    const second = t >= from + Math.min(WARM_AFTER_MS + WARM_GAP_MS, 0.6 * room);
    if (loc.i + 1 < n) {
      if (first) warm.push(loc.i + 2);
      const view = scene.hopViews[loc.i];
      // A dip with no view of its own goes out to the overview, names and all (not painted since the opening).
      if (second && view) warm.push(view.layer);
      else if (second && scene.hops[loc.i]! === "dip") warm.push(0);
    } else if (first) {
      // After the last stop the film goes back out to the overview.
      warm.push(0);
    }
  }

  // Pins and line.
  let reached = -1;
  for (let k = 0; k < n; k++) if (tl.arrive[k]! <= t) reached = k;
  const line: Pt[] = [];
  const pins = [];
  for (let k = 0; k <= reached; k++) {
    const st = input.stops[k]!;
    const p = project(scene, cam, st.x, st.y);
    line.push(p);
    pins.push({
      stop: k,
      x: p.x,
      y: p.y,
      scale: easeOutBack(clamp01((t - tl.arrive[k]!) / PIN_POP_MS)),
      current: tl.arrive[k]! <= t && t < tl.depart[k]!,
    });
  }
  if (ph === 3) {
    const s0 = input.stops[loc.i]!;
    const s1 = input.stops[loc.i + 1]!;
    const v = scene.hops[loc.i]! === "pan" ? loc.u : clamp01((loc.u - a) / (1 - 2 * a));
    const e = easeInOut(v);
    line.push(project(scene, cam, lerp(s0.x, s1.x, e), lerp(s0.y, s1.y, e)));
  }

  const light = t < tl.hitAt ? 1 : 1 - clamp01((t - tl.hitAt) / 450);
  const d = t - tl.hitAt;
  const flash = d < 0 ? 0 : d < 60 ? (0.9 * d) / 60 : 0.9 * (1 - clamp01((d - 60) / 450));

  let title: FrameModel["title"] = null;
  let prints: PrintModel[] = [];
  if (ph === 2 && t < tl.depart[loc.i]!) {
    const i = loc.i;
    const st = input.stops[i]!;
    const swaps = tl.swaps[i]!;
    let j = 0;
    for (let k = 0; k < swaps.length; k++) if (swaps[k]! <= t) j++;
    if (j > st.shots.length - 1) j = st.shots.length - 1;
    if (j < 0) j = 0;
    const base = dayBase(scene, i);
    title = {
      day: base + j,
      place: st.place ? base + st.shots.length : -1,
      opacity: Math.min(clamp01((t - tl.arrive[i]!) / 200), 1 - clamp01((t - (tl.depart[i]! - 150)) / 150)),
    };
    prints = printsAt(scene, i, t, j);
  }

  const hookOp = t >= ti.hookMs ? 0 : Math.min(clamp01(t / 400), 1 - clamp01((t - (ti.hookMs - 300)) / 300));

  const endBase = dayBase(scene, n);
  const hasCard = ti.endCardMs > 0;
  const cardOpacity = hasCard ? clamp01((t - tl.doneAt) / END_FADE_MS) : 0;

  return {
    map,
    warm,
    line,
    pins,
    light,
    prints,
    title,
    hook: { name: 0, stats: 1, opacity: hookOp },
    closing: { kicker: 2, name: 3, stats: 4, opacity: clamp01((t - tl.titleAt) / 500) },
    flash,
    endCard: { opacity: cardOpacity, name: hasCard ? endBase : -1, badgeSmall: hasCard ? endBase + 1 : -1, badgeBig: hasCard ? endBase + 2 : -1 },
    credit: { text: CREDIT_TEXT, opacity: 1 - cardOpacity },
  };
}

/** 1858 -> "1.858". */
function thousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** The scene input for these stops in this cut, on the canonical frame. */
export function sceneInput(args: {
  name: string;
  stops: Stop[];
  places: (string | null)[];
  cut: FilmCut;
  seed: number;
  days: number;
  km: number;
  photos: number;
  colorOf: (authorId: string) => string;
}): SceneInput {
  const { name, stops, places, cut, seed, days, km, photos, colorOf } = args;
  const zoom = travelZoom(stops, FILM_FRAME.w, cut);
  const hookStats = `${thousands(days)} ${days === 1 ? "día" : "días"} · ${thousands(km)} km`;
  const authors: SceneInput["authors"] = {};
  for (const stop of stops) {
    for (const shot of stop.shots) {
      authors[shot.id] = {
        initial: Array.from(shot.authorName.trim())[0]?.toUpperCase() ?? "?",
        color: colorOf(shot.authorId),
        avatar: shot.authorAvatar ? `avatar:${shot.authorId}` : null,
      };
    }
  }
  return {
    frame: { w: FILM_FRAME.w, h: FILM_FRAME.h },
    seed,
    zoom,
    name,
    hookStats,
    closingStats: `${hookStats} · ${thousands(photos)} ${photos === 1 ? "foto" : "fotos"}`,
    authors,
    stops: stops.map((stop, i) => {
      const p = toMercator(stop);
      return {
        x: p.x,
        y: p.y,
        shots: stop.shots.map((s) => s.id),
        days: stop.shots.map((_, j) => shotTitle(stop, j)),
        place: places[i] ?? null,
      };
    }),
    timeline: buildTimeline(stops, zoom, FILM_FRAME.w, cut),
    timing: {
      hookMs: cut.hookMs,
      diveMs: cut.diveMs,
      overviewMs: cut.overviewMs,
      dwellMs: cut.dwellMs,
      extraPhotoMs: cut.extraPhotoMs,
      developMs: cut.developMs,
      cardLeaveMs: cut.cardLeaveMs,
      pushIn: cut.pushIn,
      endCardMs: cut.endCardMs,
      redLight: cut.redLight,
    },
  };
}
