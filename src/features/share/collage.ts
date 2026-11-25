import { peopleLabel } from "@/features/events/event";
import type { RevealedPhoto } from "@/features/media/revealed";
import { dateFormatter } from "@/lib/intl";

/** Most photos in the Stories collage: one hero plus seven small ones. */
export const COLLAGE_MAX = 8;

/** Photos that can leave the rollo; the server already applies the whole rule. */
export function collageCandidates(photos: RevealedPhoto[]): RevealedPhoto[] {
  return photos.filter((p) => p.shareable === true);
}

/** Small seeded PRNG (mulberry32): same seed, same sequence. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Up to `COLLAGE_MAX` photos in a seeded shuffle; the first is the hero. */
export function pickCollage(
  candidates: RevealedPhoto[],
  seed: number,
): RevealedPhoto[] {
  const rand = mulberry32(seed);
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = shuffled[i] as RevealedPhoto;
    shuffled[i] = shuffled[j] as RevealedPhoto;
    shuffled[j] = tmp;
  }
  return shuffled.slice(0, COLLAGE_MAX);
}

export const canShuffle = (candidates: RevealedPhoto[]): boolean =>
  candidates.length >= 2;

export type Rect = { x: number; y: number; w: number; h: number };

const COLS = 6;
const ROWS = 4;

/** Index = photo count - 1. Cell = [column, row, columns wide, rows tall] over a 6x4 grid; the hero is first. Each template tiles the grid fully. */
type Cell = [number, number, number, number];

const TEMPLATES: Cell[][] = [
  [[0, 0, 6, 4]],
  [
    [0, 0, 4, 4],
    [4, 0, 2, 4],
  ],
  [
    [0, 0, 6, 2],
    [0, 2, 3, 2],
    [3, 2, 3, 2],
  ],
  [
    [0, 0, 4, 4],
    [4, 0, 2, 1],
    [4, 1, 2, 1],
    [4, 2, 2, 2],
  ],
  [
    [0, 0, 6, 2],
    [0, 2, 3, 1],
    [3, 2, 3, 1],
    [0, 3, 3, 1],
    [3, 3, 3, 1],
  ],
  [
    [0, 0, 4, 2],
    [4, 0, 2, 1],
    [4, 1, 2, 1],
    [0, 2, 2, 2],
    [2, 2, 2, 2],
    [4, 2, 2, 2],
  ],
  [
    [0, 0, 4, 2],
    [4, 0, 2, 1],
    [4, 1, 2, 1],
    [0, 2, 2, 2],
    [2, 2, 2, 1],
    [2, 3, 2, 1],
    [4, 2, 2, 2],
  ],
  [
    [0, 0, 4, 2],
    [4, 0, 2, 1],
    [4, 1, 2, 1],
    [0, 2, 2, 2],
    [2, 2, 2, 1],
    [2, 3, 2, 1],
    [4, 2, 2, 1],
    [4, 3, 2, 1],
  ],
];

/** Rects for `count` photos (1 to `COLLAGE_MAX`) inside `frame`, hero first, `gap` apart. */
export function collageLayout(count: number, frame: Rect, gap: number): Rect[] {
  const cells = TEMPLATES[
    Math.min(Math.max(Math.round(count), 1), COLLAGE_MAX) - 1
  ] as Cell[];
  const cellW = (frame.w - gap * (COLS - 1)) / COLS;
  const cellH = (frame.h - gap * (ROWS - 1)) / ROWS;
  return cells.map(([col, row, cols, rows]) => ({
    x: frame.x + col * (cellW + gap),
    y: frame.y + row * (cellH + gap),
    w: cols * cellW + (cols - 1) * gap,
    h: rows * cellH + (rows - 1) * gap,
  }));
}

function dayAndMonth(
  ms: number,
  timeZone: string,
): { day: string; month: string } {
  const parts = dateFormatter("es", {
    timeZone,
    day: "numeric",
    month: "long",
  }).formatToParts(ms);
  return {
    day: parts.find((p) => p.type === "day")?.value ?? "",
    month: parts.find((p) => p.type === "month")?.value ?? "",
  };
}

/** "3 – 9 de enero", "28 de diciembre – 3 de enero" or "12 de diciembre", in the trip's zone. */
export function dateRange(
  startsAt: number,
  endsAt: number,
  timeZone: string,
): string {
  const start = dayAndMonth(startsAt, timeZone);
  const end = dayAndMonth(endsAt, timeZone);
  if (start.month === end.month) {
    if (start.day === end.day) return `${start.day} de ${start.month}`;
    return `${start.day} – ${end.day} de ${end.month}`;
  }
  return `${start.day} de ${start.month} – ${end.day} de ${end.month}`;
}

/** Collage footer, e.g. "3 – 9 de enero · 8 personas". */
export function collageCaption(input: {
  startsAt: number;
  endsAt: number;
  timeZone: string;
  people: number;
}): string {
  return `${dateRange(input.startsAt, input.endsAt, input.timeZone)} · ${peopleLabel(input.people)}`;
}
