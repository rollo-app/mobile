import type { RevealedPhoto } from "@/features/media/revealed";
import { formatTime } from "@/features/trips/phase";
import { dateFormatter } from "@/lib/intl";
import { formatCount } from "./format";
import { dayNumber, localDay } from "./story";

export type AwardKind = "firstLight" | "nightShift" | "script" | "locations" | "camera";
export type Award = { kind: AwardKind; title: string; names: string[]; detail: string; photo: RevealedPhoto };
export type Credits = { awards: Award[]; cast: string[] };

export const AWARD_TITLES: Record<AwardKind, string> = {
  firstLight: "Primera luz",
  nightShift: "Turno noche",
  script: "Guion",
  locations: "Locaciones",
  camera: "Cámara",
};

export const MIN_CREDIT_PHOTOS = 10;
export const MIN_CREDIT_AUTHORS = 2;
export const MIN_CAPTIONS = 3;
export const MIN_PLACES = 3;
export const MIN_CAMERA_PHOTOS = 5;

const FIRST_LIGHT_FROM = 5 * 3600;
const FIRST_LIGHT_TO = 9 * 3600;

/** ["Juani"] → "Juani"; ["Juani","Sofi"] → "Juani y Sofi". */
export function awardNames(names: string[]): string {
  return names.join(" y ");
}

const byTime = (a: RevealedPhoto, b: RevealedPhoto) => a.takenAt - b.takenAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Seconds since local midnight. `hourCycle: "h23"` because Hermes may format midnight as "24". */
function secondsOfDay(ms: number, timeZone: string): number {
  const parts = dateFormatter("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(ms);
  let h = 0;
  let m = 0;
  let s = 0;
  for (const part of parts) {
    if (part.type === "hour") h = Number(part.value) % 24;
    else if (part.type === "minute") m = Number(part.value);
    else if (part.type === "second") s = Number(part.value);
  }
  return h * 3600 + m * 60 + s;
}

type AuthorStats = {
  name: string;
  count: number;
  captions: number;
  /** The photo with the longest trimmed caption (earliest on a tie). */
  captionPhoto: RevealedPhoto | null;
  captionLength: number;
  cells: Set<string>;
  /** The photo that added their last new cell. */
  lastNewCellPhoto: RevealedPhoto | null;
  /** The most liked photo (earliest on a tie). */
  likedPhoto: RevealedPhoto | null;
};

type Timed = { photo: RevealedPhoto; seconds: number };

export function computeCredits(photos: RevealedPhoto[], timeZone: string, blockedUserIds: ReadonlySet<string>): Credits {
  const eligible: RevealedPhoto[] = [];
  let earliest = Infinity;
  for (const p of photos) {
    if (p.takenAt < earliest) earliest = p.takenAt;
    if (!p.archived && !blockedUserIds.has(p.authorUserId)) eligible.push(p);
  }
  eligible.sort(byTime);

  const cast = new Map<string, string>();
  for (const p of eligible) if (!cast.has(p.author.id)) cast.set(p.author.id, p.author.name);
  const castNames = [...cast.values()];

  // Authors keep insertion order = who took their first eligible photo first.
  const stats = new Map<string, AuthorStats>();
  let photoCount = 0;
  let firstLight: Timed | null = null;
  let nightShift: Timed | null = null;

  for (const p of eligible) {
    if (p.type !== "photo") continue;
    photoCount++;
    let st = stats.get(p.author.id);
    if (!st) {
      st = {
        name: p.author.name,
        count: 0,
        captions: 0,
        captionPhoto: null,
        captionLength: 0,
        cells: new Set(),
        lastNewCellPhoto: null,
        likedPhoto: null,
      };
      stats.set(p.author.id, st);
    }
    st.count++;
    if (!st.likedPhoto || p.likeCount > st.likedPhoto.likeCount) st.likedPhoto = p;
    const caption = p.caption?.trim();
    if (caption) {
      st.captions++;
      if (caption.length > st.captionLength) {
        st.captionLength = caption.length;
        st.captionPhoto = p;
      }
    }
    if (p.lat != null && p.lng != null) {
      const cell = `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`;
      if (!st.cells.has(cell)) {
        st.cells.add(cell);
        st.lastNewCellPhoto = p;
      }
    }
    const seconds = secondsOfDay(p.takenAt, timeZone);
    if (seconds >= FIRST_LIGHT_FROM && seconds < FIRST_LIGHT_TO) {
      if (!firstLight || seconds < firstLight.seconds || (seconds === firstLight.seconds && p.id < firstLight.photo.id)) {
        firstLight = { photo: p, seconds };
      }
    } else if (seconds < FIRST_LIGHT_FROM) {
      if (!nightShift || seconds > nightShift.seconds || (seconds === nightShift.seconds && p.id < nightShift.photo.id)) {
        nightShift = { photo: p, seconds };
      }
    }
  }

  if (photoCount < MIN_CREDIT_PHOTOS || stats.size < MIN_CREDIT_AUTHORS) return { awards: [], cast: castNames };

  const first = dayNumber(localDay(earliest, timeZone));
  const timed = (kind: AwardKind, t: Timed): Award => ({
    kind,
    title: AWARD_TITLES[kind],
    names: [t.photo.author.name],
    detail: `${formatTime(t.photo.takenAt, timeZone)} · Día ${dayNumber(localDay(t.photo.takenAt, timeZone)) - first + 1}`,
    photo: t.photo,
  });

  /** The top authors by `count` (at least `min`): one, or two sharing it; three or more → no award. */
  const counted = (
    kind: AwardKind,
    count: (s: AuthorStats) => number,
    min: number,
    unit: string,
    background: (s: AuthorStats) => RevealedPhoto | null,
  ): Award | null => {
    let top = 0;
    for (const s of stats.values()) top = Math.max(top, count(s));
    if (top < min) return null;
    const winners: AuthorStats[] = [];
    for (const s of stats.values()) if (count(s) === top) winners.push(s);
    if (winners.length > 2) return null;
    const photo = background(winners[0]!);
    if (!photo) return null;
    return {
      kind,
      title: AWARD_TITLES[kind],
      names: winners.map((w) => w.name),
      detail: `${formatCount(top)} ${unit}`,
      photo,
    };
  };

  const awards = [
    firstLight ? timed("firstLight", firstLight) : null,
    nightShift ? timed("nightShift", nightShift) : null,
    counted("script", (s) => s.captions, MIN_CAPTIONS, "textos", (s) => s.captionPhoto),
    counted("locations", (s) => s.cells.size, MIN_PLACES, "lugares", (s) => s.lastNewCellPhoto),
    counted("camera", (s) => s.count, MIN_CAMERA_PHOTOS, "fotos", (s) => s.likedPhoto),
  ].filter((a): a is Award => a !== null);

  return { awards, cast: castNames };
}
