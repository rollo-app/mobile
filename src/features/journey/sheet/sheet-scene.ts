// The contact-sheet film, pure scene (for rolls with no route: a wedding, a company party). Same idea as the route
// film's `engine/scene.ts`: `buildSheetScene` lays the film out once and `sheetFrameAt(scene, t)` says what is on the
// frame at millisecond `t` as plain data. Pure: no Skia, no React (only types; the caller passes `FILM_FRAME` as the frame).
import type { Size } from "../engine/model";

export type SheetCellInput = {
  /** Unique id of the cell (the key of its photo in the assets). */
  id: string;
  takenAt: number;
  /** Minutes since local midnight of the photo (0-1439), in the roll's time zone. The caller knows the zone. */
  localMinutes: number;
  /** Local day number of the photo, 1-based, counted from the first photo's local day. The caller fills it. */
  day: number;
  author: { initial: string; color: string; avatar: string | null };
};

export type SheetInput = {
  frame: Size;
  seed: number;
  name: string;
  dateLine: string;
  closingLine: string;
  /** Up to 30 photos (the scene puts them in time order). */
  cells: SheetCellInput[];
  /** Ids of the highlighted cells (the caller keeps them to 12), in any order: the film shows them in time order. */
  highlights: string[];
};

export type SheetText = { text: string; role: "hookName" | "hookStats" | "closingName" | "closingStats" | "place" | "day" | "endName" | "badgeSmall" | "badgeBig" | "initial" };

export type SheetLayout = {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  /** Top-left of each shown cell, in the sheet's own coordinates (= frame coordinates with the camera at rest). */
  cells: { x: number; y: number }[];
  /** The dark sheet under the cells. */
  panel: { x: number; y: number; w: number; h: number };
};

export type SheetScene = {
  input: SheetInput;
  /** The cells the sheet shows (a count that fills its grid): `input.cells` without the ones dropped from the end. */
  cells: SheetCellInput[];
  layout: SheetLayout;
  texts: SheetText[];
  /** Index in `texts` of: the cover name, the date line, the closing name and line, the event name (small), the end card's three. */
  ix: { coverName: number; coverDate: number; closingName: number; closingLine: number; eventName: number; endName: number; badgeSmall: number; badgeBig: number };
  /** Same shape the shared drawing helpers expect: who took each cell, and the index of their initial in `texts`. */
  authors: Record<string, { initial: string; color: string; avatar: string | null }>;
  authorTexts: Record<string, number>;
  /** Highlighted cells in time order: index in `layout.cells` and the index in `texts` of its time line. */
  highlights: { cell: number; time: number }[];
  /** Per-cell develop start (ms), staggered as a wave in time order. */
  developStart: number[];
  /** Zoom (sheet → frame) at which a highlighted cell is 0.78 of the frame wide. */
  holdScale: number;
  t: { coverEnd: number; developEnd: number; moveMs: number; holdMs: number; highlightsEnd: number; overviewEnd: number; doneAt: number };
  durationMs: number;
};

export type SheetModel = {
  /** Sheet → frame: p_frame = (tx, ty) + s * p_sheet. */
  camera: { s: number; tx: number; ty: number };
  /** Per shown cell: develop (-1 = empty paper, 0..1 developing), highlight weight 0..1 and dimming 0..1 (1 = the full 45 % black). */
  cells: { develop: number; weight: number; dim: number }[];
  /** Opacity of the top scrim. */
  scrim: number;
  cover: { opacity: number };
  closing: { opacity: number };
  /** Time lines shown (one, or two while cross-fading) and the opacity of the event name under them. */
  title: { items: { text: number; opacity: number }[]; name: number };
  endCard: { opacity: number; name: number; badgeSmall: number; badgeBig: number };
};

export const SHEET_TOTAL_MAX_MS = 59000;
const COVER_MS = 1800;
const DEVELOP_MS = 2500;
const CELL_DEVELOP_MS = 700;
const MOVE_MS = 800;
const HOLD_MS = 2600;
const OVERVIEW_MS = 1500;
const OVERVIEW_PULL_MS = 1000;
const TITLE_FADE_MS = 250;
const CLOSING_MS = 2600;
const END_CARD_MS = 2500;
const END_FADE_MS = 400;
export const PUSH_IN = 0.05;
export const HOLD_WIDTH = 0.78;
/** Where the held cell is centred, as a share of the frame. */
export const HOLD_CENTER = { x: 0.5, y: 0.53 };
const TITLE_AREA = 112;
const BOTTOM_MARGIN = 24;
const SIDE_MARGIN = 20;
const GAP = 5;

function clamp01(x: number): number {
  "worklet";
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function easeInOut(u: number): number {
  "worklet";
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

function easeOut(u: number): number {
  "worklet";
  const c = clamp01(u);
  return 1 - (1 - c) * (1 - c);
}

function smooth(u: number): number {
  "worklet";
  const c = clamp01(u);
  return c * c * (3 - 2 * c);
}

function two(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

/** "23:40", or "Día 2 · 23:40" when the photos span more than one calendar day. */
function timeLabel(cell: SheetCellInput, multiDay: boolean): string {
  const clock = two(Math.floor(cell.localMinutes / 60)) + ":" + two(cell.localMinutes % 60);
  return multiDay ? "Día " + cell.day + " · " + clock : clock;
}

export function sheetColumns(count: number): number {
  return count <= 12 ? 3 : count <= 20 ? 4 : 5;
}

/**
 * The cells the sheet shows out of `available` (at most 30): the most that fill whole rows, dropping from the end the
 * ones that are not highlights. A handful of cells (under 6) are all kept, on 3 columns.
 */
export function shownCells(cells: SheetCellInput[], highlights: string[]): SheetCellInput[] {
  const all = cells.slice(0, 30);
  const cols = sheetColumns(all.length);
  const target = all.length < 6 ? all.length : Math.floor(all.length / cols) * cols;
  let drop = all.length - target;
  const wanted = new Set(highlights);
  const dropped = new Set<number>();
  for (let i = all.length - 1; i >= 0 && drop > 0; i--) {
    if (wanted.has(all[i]!.id)) continue;
    dropped.add(i);
    drop--;
  }
  return all.filter((_, i) => !dropped.has(i));
}

export function buildSheetScene(input: SheetInput): SheetScene {
  const { w, h } = input.frame;
  // Time order first, so the grid, the develop wave and the highlights all follow the clock.
  const byTime = [...input.cells].sort((a, b) => a.takenAt - b.takenAt);
  const cellsIn = shownCells(byTime, input.highlights);
  const n = cellsIn.length;
  const cols = sheetColumns(n);
  const rows = Math.max(1, Math.ceil(n / cols));
  const used = Math.max(1, Math.min(cols, n));
  const availW = w - 2 * SIDE_MARGIN;
  const availH = h - TITLE_AREA - BOTTOM_MARGIN;
  // As wide as the margins allow, unless the rows would not fit under the title.
  const byWidth = (availW - GAP * (cols - 1)) / cols;
  const byHeight = ((availH - GAP * (rows - 1)) / rows) * 0.75;
  const cellW = Math.min(byWidth, byHeight);
  const cellH = (cellW * 4) / 3;
  const sheetW = used * cellW + (used - 1) * GAP;
  const sheetH = rows * cellH + (rows - 1) * GAP;
  const x0 = (w - sheetW) / 2;
  const y0 = TITLE_AREA + (availH - sheetH) / 2;
  const cells: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) cells.push({ x: x0 + (i % cols) * (cellW + GAP), y: y0 + Math.floor(i / cols) * (cellH + GAP) });
  const pad = 10;
  const layout: SheetLayout = { cols, rows, cellW, cellH, cells, panel: { x: x0 - pad, y: y0 - pad, w: sheetW + 2 * pad, h: sheetH + 2 * pad } };

  const multiDay = cellsIn.some((c) => c.day !== cellsIn[0]!.day);
  const texts: SheetText[] = [
    { text: input.name, role: "hookName" },
    { text: input.dateLine, role: "hookStats" },
    { text: input.name, role: "closingName" },
    { text: input.closingLine, role: "closingStats" },
    { text: input.name, role: "place" },
    { text: "Rollo Project", role: "endName" },
    { text: "Consíguelo en el", role: "badgeSmall" },
    { text: "App Store", role: "badgeBig" },
  ];
  const ix = { coverName: 0, coverDate: 1, closingName: 2, closingLine: 3, eventName: 4, endName: 5, badgeSmall: 6, badgeBig: 7 };

  const authors: SheetScene["authors"] = {};
  const authorTexts: SheetScene["authorTexts"] = {};
  const initialAt: Record<string, number> = {};
  for (const c of cellsIn) {
    authors[c.id] = c.author;
    let at = initialAt[c.author.initial];
    if (at === undefined) {
      at = texts.length;
      initialAt[c.author.initial] = at;
      texts.push({ text: c.author.initial, role: "initial" });
    }
    authorTexts[c.id] = at;
  }

  const highlights: SheetScene["highlights"] = [];
  const wanted = new Set(input.highlights);
  for (let i = 0; i < n; i++) {
    const c = cellsIn[i]!;
    if (!wanted.has(c.id)) continue;
    highlights.push({ cell: i, time: texts.length });
    texts.push({ text: timeLabel(c, multiDay), role: "day" });
  }

  // A small seeded jitter keeps the wave from looking mechanical; it stays under half the spacing between neighbours
  // each way, so cells still start in time order.
  let rng = (input.seed * 2654435761) >>> 0;
  const developStart: number[] = [];
  for (let i = 0; i < n; i++) {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    const spacing = n > 1 ? (DEVELOP_MS - CELL_DEVELOP_MS) / (n - 1) : 0;
    const jitter = (rng / 4294967296 - 0.5) * 0.8 * spacing;
    const base = i * spacing;
    developStart.push(COVER_MS + Math.min(DEVELOP_MS - CELL_DEVELOP_MS, Math.max(0, base + jitter)));
  }

  const hn = highlights.length;
  const overviewMs = OVERVIEW_MS;
  const fixed = COVER_MS + DEVELOP_MS + hn * MOVE_MS + overviewMs + CLOSING_MS + END_CARD_MS;
  const holdMs = hn > 0 ? Math.min(HOLD_MS, Math.max(0, (SHEET_TOTAL_MAX_MS - fixed) / hn)) : HOLD_MS;
  const developEnd = COVER_MS + DEVELOP_MS;
  const highlightsEnd = developEnd + hn * (MOVE_MS + holdMs);
  const overviewEnd = highlightsEnd + overviewMs;
  const doneAt = overviewEnd + CLOSING_MS;
  return {
    input,
    cells: cellsIn,
    layout,
    texts,
    ix,
    authors,
    authorTexts,
    highlights,
    developStart,
    holdScale: (HOLD_WIDTH * w) / cellW,
    t: { coverEnd: COVER_MS, developEnd, moveMs: MOVE_MS, holdMs, highlightsEnd, overviewEnd, doneAt },
    durationMs: doneAt + END_CARD_MS,
  };
}

/** What is on the frame at time `t` (ms from the start of the film). */
export function sheetFrameAt(scene: SheetScene, t: number): SheetModel {
  "worklet";
  const { w, h } = scene.input.frame;
  const tt = scene.t;
  const n = scene.cells.length;
  const ax = HOLD_CENTER.x * w;
  const ay = HOLD_CENTER.y * h;
  const hl = scene.highlights;
  const hn = hl.length;
  const cw = scene.layout.cellW;
  const ch = scene.layout.cellH;

  // The camera is a scale `s` and the sheet point `v` that sits on the anchor (the held cell's spot on the frame).
  let s = 1;
  let vx = ax;
  let vy = ay;
  let dim = 0;
  const weights: number[] = [];
  for (let i = 0; i < n; i++) weights.push(0);
  const titleItems: { text: number; opacity: number }[] = [];
  let coverO = 1;
  let closingO = 0;
  let scrim = 0;
  let nameO = 0;
  const s0 = scene.holdScale;

  const centerX = (k: number) => scene.layout.cells[hl[k]!.cell]!.x + cw / 2;
  const centerY = (k: number) => scene.layout.cells[hl[k]!.cell]!.y + ch / 2;

  if (t >= tt.developEnd && hn > 0) {
    if (t < tt.highlightsEnd) {
      const slot = tt.moveMs + tt.holdMs;
      const k = Math.min(hn - 1, Math.floor((t - tt.developEnd) / slot));
      const local = t - tt.developEnd - k * slot;
      if (local < tt.moveMs) {
        const u = easeInOut(local / tt.moveMs);
        // The time lines never overlap: the old one is gone in the move's first 250 ms, the new one comes in its last 250.
        const fOut = 1 - smooth(local / TITLE_FADE_MS);
        const fIn = smooth((local - (tt.moveMs - TITLE_FADE_MS)) / TITLE_FADE_MS);
        const fromS = k === 0 ? 1 : s0 * (1 + PUSH_IN);
        const fromX = k === 0 ? ax : centerX(k - 1);
        const fromY = k === 0 ? ay : centerY(k - 1);
        s = fromS * Math.pow(s0 / fromS, u);
        vx = fromX + (centerX(k) - fromX) * u;
        vy = fromY + (centerY(k) - fromY) * u;
        dim = k === 0 ? u : 1;
        weights[hl[k]!.cell] = u;
        if (k > 0) {
          weights[hl[k - 1]!.cell] = 1 - u;
          titleItems.push({ text: hl[k - 1]!.time, opacity: fOut });
        }
        titleItems.push({ text: hl[k]!.time, opacity: fIn });
        coverO = k === 0 ? fOut : 0;
        scrim = k === 0 ? smooth(u) : 1;
        nameO = k === 0 ? fIn : 1;
      } else {
        const ph = (local - tt.moveMs) / tt.holdMs;
        s = s0 * (1 + PUSH_IN * easeOut(ph));
        vx = centerX(k);
        vy = centerY(k);
        dim = 1;
        weights[hl[k]!.cell] = 1;
        titleItems.push({ text: hl[k]!.time, opacity: 1 });
        coverO = 0;
        scrim = 1;
        nameO = 1;
      }
    } else {
      const local = t - tt.highlightsEnd;
      const u = easeInOut(clamp01(local / OVERVIEW_PULL_MS));
      const fromS = s0 * (1 + PUSH_IN);
      s = fromS * Math.pow(1 / fromS, u);
      vx = centerX(hn - 1) + (ax - centerX(hn - 1)) * u;
      vy = centerY(hn - 1) + (ay - centerY(hn - 1)) * u;
      dim = 1 - u;
      weights[hl[hn - 1]!.cell] = 1 - u;
      const f = 1 - smooth(local / 400);
      if (f > 0) titleItems.push({ text: hl[hn - 1]!.time, opacity: f });
      coverO = 0;
      scrim = f;
      nameO = f;
      closingO = smooth((local - 1000) / 500);
    }
  } else if (t >= tt.developEnd) {
    // No highlights at all: the sheet just stays, then the closing lines.
    coverO = 1 - smooth((t - tt.developEnd) / 400);
    closingO = smooth((t - tt.developEnd - 400) / 500);
  }
  if (t >= tt.overviewEnd) closingO = 1;

  const tx = ax - s * vx;
  const ty = ay - s * vy;
  const cells: SheetModel["cells"] = [];
  for (let i = 0; i < n; i++) {
    const start = scene.developStart[i]!;
    const develop = t < start ? -1 : clamp01((t - start) / CELL_DEVELOP_MS);
    cells.push({ develop, weight: weights[i]!, dim: dim * (1 - weights[i]!) });
  }

  const cardO = clamp01((t - tt.doneAt) / END_FADE_MS);
  return {
    camera: { s, tx, ty },
    cells,
    scrim,
    cover: { opacity: coverO },
    closing: { opacity: closingO },
    title: { items: titleItems, name: nameO },
    endCard: { opacity: cardO, name: scene.ix.endName, badgeSmall: scene.ix.badgeSmall, badgeBig: scene.ix.badgeBig },
  };
}
