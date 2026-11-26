// The route of a trip film: the stops, the photos each one shows and the timeline that paces them.
// Pure logic, no imports: it runs without Skia, React or the app around it.

export type ImageRef = { uri: string; headers?: Record<string, string> };
export type FilmPhoto = {
  id: string;
  /** Who took it: each person's own photos are what tells when somebody really changed place. */
  authorId: string;
  authorName: string;
  /** null: no profile picture. */
  authorAvatar: ImageRef | null;
  lat: number;
  lng: number;
  takenAt: number;
  /** The roll's local day ("2026-07-01"). */
  day: string;
  likeCount: number;
  thumb: ImageRef;
  display: ImageRef;
};
/** A place of the trip. `dayNumber` is the day it was first photographed, `lastDayNumber` the last one (the same for a single day). */
export type Stop = {
  index: number;
  lat: number;
  lng: number;
  /** Every photo taken here, in time order. */
  photos: FilmPhoto[];
  /** The photos the film shows here, in time order: its share of the photo budget (at least one). The first is the one on the pin. */
  shots: FilmPhoto[];
  /** Roll day (1 = the roll's first day) of each shot. */
  shotDays: number[];
  dayNumber: number;
  lastDayNumber: number;
};
export type Timeline = {
  arrive: number[];
  leave: number[];
  depart: number[];
  move: number[];
  /** For each stop, when each further shot takes the place of the one before it. */
  swaps: number[][];
  overviewAt: number;
  hitAt: number;
  titleAt: number;
  doneAt: number;
};

export type FilmCut = {
  hookMs: number;
  diveMs: number;
  dwellMs: number;
  /** A further photo at the same stop (the first one takes `dwellMs`). */
  extraPhotoMs: number;
  developMs: number;
  overviewMs: number;
  /** A hop between stops takes between these two, by how far it goes. */
  hopMinMs: number;
  hopMaxMs: number;
  /** After the flash: the closing title, then the buttons. */
  titleDelayMs: number;
  doneDelayMs: number;
  cardLeaveMs: number;
  /** How much the photo keeps growing while it is held (0 = still). */
  pushIn: number;
  maxStops: number;
  /** The photo budget of the film, shared among the stops by how many photos each has. */
  maxPhotos: number;
  /** No stop shows more than this many, however many it has. */
  maxPerStop: number;
  /** The whole film never lasts longer than this, end card included. */
  maxTotalMs: number;
  /** A card after the closing title, part of the film and of the limit above; 0 = none. */
  endCardMs: number;
  /** The red darkroom light over the map while the photos develop. */
  redLight: boolean;
  /** Stops sit at the centre of their 0.05° cell, and two in a row never share one. */
  snapToCell: boolean;
  /** A place measures at least this much of radius. */
  minPlaceKm: number;
  /** The travel zoom never goes past this. */
  maxZoom: number;
  /** Titles name only the city (and the country when the trip crosses countries). */
  cityTitles: boolean;
};

/** The canonical frame the film is laid out in, in points. */
export const FILM_FRAME = { w: 432, h: 768 };
/** Side of the cells stops snap to, in degrees (about 5 km). */
export const CELL_DEG = 0.05;

const REVEAL_CUT: FilmCut = {
  hookMs: 2200,
  diveMs: 1500,
  dwellMs: 1600,
  extraPhotoMs: 1800,
  developMs: 950,
  overviewMs: 1700,
  hopMinMs: 800,
  hopMaxMs: 1900,
  titleDelayMs: 500,
  doneDelayMs: 1400,
  cardLeaveMs: 200,
  pushIn: 0,
  maxStops: 10,
  maxPhotos: 10,
  maxPerStop: 1,
  maxTotalMs: 59_000,
  endCardMs: 0,
  redLight: true,
  snapToCell: false,
  minPlaceKm: 0.5,
  maxZoom: 13,
  cityTitles: false,
};

/**
 * The same scene at two paces. `share` is the cut to post as an Instagram story, made to be READ and to stay under
 * the 59 s a story takes (the end card included): 15 photos shared among at most 15 stops. `reveal` is the pace of
 * the reveal inside the app.
 */
export const FILM_CUTS: { share: FilmCut; reveal: FilmCut } = {
  reveal: REVEAL_CUT,
  share: {
    ...REVEAL_CUT,
    hookMs: 1800,
    diveMs: 1400,
    dwellMs: 2600,
    developMs: 600,
    overviewMs: 1500,
    hopMinMs: 700,
    hopMaxMs: 1500,
    titleDelayMs: 400,
    doneDelayMs: 2600,
    pushIn: 0.05,
    maxStops: 15,
    maxPhotos: 15,
    maxPerStop: 4,
    endCardMs: 2500,
    redLight: false,
    snapToCell: true,
    minPlaceKm: 2.5,
    maxZoom: 10,
    cityTitles: true,
  },
};

type LatLng = { lat: number; lng: number };

const RAD = Math.PI / 180;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Web-mercator on the unit square. */
export function toMercator(p: LatLng): { x: number; y: number } {
  const s = Math.sin(clamp(p.lat, -85.05, 85.05) * RAD);
  return { x: (p.lng + 180) / 360, y: 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI) };
}

function mercatorDistance(a: LatLng, b: LatLng): number {
  const pa = toMercator(a);
  const pb = toMercator(b);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** The centre of the 0.05° cell a point falls in. */
export function cellCenter(p: LatLng): LatLng {
  return {
    lat: round6((Math.floor(p.lat / CELL_DEG) + 0.5) * CELL_DEG),
    lng: round6((Math.floor(p.lng / CELL_DEG) + 0.5) * CELL_DEG),
  };
}

const cellKey = (p: LatLng) => `${Math.floor(p.lat / CELL_DEG)},${Math.floor(p.lng / CELL_DEG)}`;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function dayIndex(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

const byTime = (a: FilmPhoto, b: FilmPhoto) => a.takenAt - b.takenAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

type Place = { photos: FilmPhoto[]; sumLat: number; sumLng: number };
const centerOf = (g: Place): LatLng => ({ lat: g.sumLat / g.photos.length, lng: g.sumLng / g.photos.length });

/**
 * The places of the roll, in the order they were first photographed: each photo joins the nearest place within
 * `radiusKm` or starts a new one, and places that end up within the radius of an earlier one are folded into it.
 * It is the vocabulary of the route ("the same place" for two people, or for two visits days apart), not the route.
 */
function findPlaces(sorted: FilmPhoto[], radiusKm: number): FilmPhoto[][] {
  const places: Place[] = [];
  for (const p of sorted) {
    let best: Place | null = null;
    let bestKm = Infinity;
    for (const g of places) {
      const km = haversineKm(centerOf(g), p);
      if (km <= radiusKm && km < bestKm) {
        best = g;
        bestKm = km;
      }
    }
    if (best) {
      best.photos.push(p);
      best.sumLat += p.lat;
      best.sumLng += p.lng;
    } else {
      places.push({ photos: [p], sumLat: p.lat, sumLng: p.lng });
    }
  }
  const merged: Place[] = [];
  for (const g of places) {
    const into = merged.find((m) => haversineKm(centerOf(m), centerOf(g)) <= radiusKm);
    if (into) {
      into.photos.push(...g.photos);
      into.sumLat += g.sumLat;
      into.sumLng += g.sumLng;
    } else {
      merged.push(g);
    }
  }
  return merged.map((g) => g.photos.sort(byTime));
}

/**
 * The route in time order. Reading the photos of the whole group as one sequence breaks as soon as two people are
 * apart: their photos alternate and the route bounces between both places although nobody moved. So the sequence is
 * read per person: somebody's own photos say when THAT person changed place (a "visit"), and the route moves on when
 * a visit starts somewhere else. Coming back to a place is a new stop (the way back is part of the trip).
 */
function routeBySequence(sorted: FilmPhoto[], places: FilmPhoto[][]): FilmPhoto[][] {
  const placeOf = new Map<string, number>();
  places.forEach((group, i) => group.forEach((p) => placeOf.set(p.id, i)));
  type Visit = { place: number; photos: FilmPhoto[] };
  const ongoing = new Map<string, Visit>();
  const visits: Visit[] = [];
  for (const p of sorted) {
    const place = placeOf.get(p.id) ?? -1;
    const mine = ongoing.get(p.authorId);
    if (mine && mine.place === place) {
      mine.photos.push(p);
    } else {
      const visit = { place, photos: [p] };
      visits.push(visit);
      ongoing.set(p.authorId, visit);
    }
  }
  // Visits are in the order they started: the route is that order, with a visit to the stop it is already on folded in.
  const stops: Visit[] = [];
  for (const visit of visits) {
    const last = stops[stops.length - 1];
    if (last && last.place === visit.place) last.photos.push(...visit.photos);
    else stops.push({ place: visit.place, photos: [...visit.photos] });
  }
  return stops.map((s) => s.photos.sort(byTime));
}

/**
 * With cells, consecutive stops that land in the same cell are one stop (their photos joined, in time order): the
 * film would otherwise hop between two pins on the very same spot. The photo budget is shared after this.
 */
function mergeSameCell(groups: FilmPhoto[][]): FilmPhoto[][] {
  const out: FilmPhoto[][] = [];
  let lastKey = "";
  for (const group of groups) {
    const key = cellKey({ lat: median(group.map((p) => p.lat)), lng: median(group.map((p) => p.lng)) });
    const last = out[out.length - 1];
    if (last && key === lastKey) last.push(...group);
    else out.push([...group]);
    lastKey = key;
  }
  return out.map((g) => g.sort(byTime));
}

/**
 * How many photos each stop shows out of a budget of `maxPhotos`: one each, and the rest go one at a time to the stop
 * with the most photos per photo already shown (so a place with 30 photos shows more than one with 3), never more than
 * `maxPerStop` nor than it has.
 */
function shotCounts(groups: FilmPhoto[][], maxPhotos: number, maxPerStop: number): number[] {
  const counts = groups.map(() => 1);
  for (let left = maxPhotos - groups.length; left > 0; left--) {
    let best = -1;
    let bestScore = 0;
    groups.forEach((group, i) => {
      const shown = counts[i]!;
      if (shown >= group.length || shown >= maxPerStop) return;
      const score = group.length / (shown + 1);
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    });
    if (best === -1) break;
    counts[best] = counts[best]! + 1;
  }
  return counts;
}

/** `k` of a stop's photos (in time order): the most liked, the ties spread evenly over the time at the stop. */
function pickShots(group: FilmPhoto[], k: number): FilmPhoto[] {
  if (k >= group.length) return group;
  const byLikes = [...group].sort((a, b) => b.likeCount - a.likeCount);
  const cutoff = byLikes[k - 1]!.likeCount;
  const sure = group.filter((p) => p.likeCount > cutoff);
  const tied = group.filter((p) => p.likeCount === cutoff);
  const need = k - sure.length;
  const picked: FilmPhoto[] = [];
  for (let j = 0; j < need; j++) picked.push(tied[Math.max(0, Math.floor(((j + 0.5) * tied.length) / need - 0.5))]!);
  return [...sure, ...picked].sort(byTime);
}

/**
 * The stops of the film. First the route in time order (`routeBySequence`); if that takes more stops than a film can
 * hold even with wider places (people scattered all along, coming and going), each place is shown once instead, in the
 * order it was first visited. Then the photo budget is shared among them (`shotCounts`).
 * `firstDay`: the roll's first local day ("2026-07-01"); day numbers count from it.
 */
export function buildStops(photos: FilmPhoto[], cut: FilmCut, firstDay: string): Stop[] {
  if (photos.length === 0) return [];
  const sorted = [...photos].sort(byTime);
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of sorted) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  const extentKm = haversineKm({ lat: minLat, lng: minLng }, { lat: maxLat, lng: maxLng });
  // What counts as "the same place" scales with the trip: a venue in a night out, a town in a road trip.
  const baseKm = clamp(extentKm * 0.06, cut.minPlaceKm, 15);
  const settle = (route: FilmPhoto[][]) => (cut.snapToCell ? mergeSameCell(route) : route);
  let groups: FilmPhoto[][] | null = null;
  for (let round = 0, radiusKm = baseKm; round < 4; round++, radiusKm *= 1.5) {
    const route = settle(routeBySequence(sorted, findPlaces(sorted, radiusKm)));
    if (route.length <= cut.maxStops) {
      groups = route;
      break;
    }
  }
  if (!groups) {
    let radiusKm = baseKm;
    groups = settle(findPlaces(sorted, radiusKm));
    for (let round = 0; round < 12 && groups.length > cut.maxStops; round++) {
      radiusKm *= 1.5;
      groups = settle(findPlaces(sorted, radiusKm));
    }
  }
  const first = dayIndex(firstDay);
  const counts = shotCounts(groups, cut.maxPhotos, cut.maxPerStop);
  return groups.map((group, index) => {
    const shots = pickShots(group, counts[index]!);
    const where = cut.snapToCell
      ? cellCenter({ lat: median(group.map((p) => p.lat)), lng: median(group.map((p) => p.lng)) })
      : { lat: shots[0]!.lat, lng: shots[0]!.lng };
    return {
      index,
      lat: where.lat,
      lng: where.lng,
      photos: group,
      shots,
      shotDays: shots.map((p) => dayIndex(p.day) - first + 1),
      dayNumber: dayIndex(group[0]!.day) - first + 1,
      lastDayNumber: dayIndex(group[group.length - 1]!.day) - first + 1,
    };
  });
}

/** The day title while shot `j` of a stop is on screen: its own day when the stop shows several photos. */
export function shotTitle(stop: Stop, j: number): string {
  return stop.shots.length > 1 ? `Día ${stop.shotDays[j] ?? stop.dayNumber}` : dayLabel(stop);
}

/** "Día 3", or "Días 1–6" for a place the group kept coming back to. */
function dayLabel(stop: Stop): string {
  return stop.lastDayNumber > stop.dayNumber ? `Días ${stop.dayNumber}–${stop.lastDayNumber}` : `Día ${stop.dayNumber}`;
}

export function routeKm(stops: Stop[]): number {
  let total = 0;
  for (let i = 1; i < stops.length; i++) total += haversineKm(stops[i - 1]!, stops[i]!);
  return Math.round(total);
}

export function travelZoom(stops: Stop[], frameWidth: number, cut: FilmCut): number {
  if (stops.length < 2) return clamp(10, 3, cut.maxZoom);
  const ds: number[] = [];
  for (let i = 1; i < stops.length; i++) ds.push(mercatorDistance(stops[i - 1]!, stops[i]!));
  ds.sort((a, b) => a - b);
  const mid = Math.floor(ds.length / 2);
  const d = ds.length % 2 ? ds[mid]! : (ds[mid - 1]! + ds[mid]!) / 2;
  if (!(d > 0)) return clamp(10, 3, cut.maxZoom);
  return clamp(Math.log2((0.85 * frameWidth) / (512 * d)), 3, cut.maxZoom);
}

function hopMs(a: LatLng, b: LatLng, zoom: number, frameWidth: number, cut: FilmCut): number {
  const screens = (mercatorDistance(a, b) * 512 * 2 ** zoom) / frameWidth;
  // The curve was tuned for a 1900 ms ceiling; a faster cut scales it down.
  const scaled = (650 + 420 * Math.log2(1 + screens)) * (cut.hopMaxMs / 1900);
  return Math.round(clamp(scaled, cut.hopMinMs, cut.hopMaxMs));
}

/** A hop never gets shorter than this to fit the limit: below it the camera only jerks. */
const HOP_FLOOR_MS = 450;
/** Nor a further photo: under a second it cannot be looked at. */
const EXTRA_FLOOR_MS = 1000;

export function buildTimeline(stops: Stop[], zoom: number, frameWidth: number, cut: FilmCut): Timeline {
  const n = stops.length;
  const move: number[] = [];
  for (let i = 0; i < n - 1; i++) move[i] = hopMs(stops[i]!, stops[i + 1]!, zoom, frameWidth, cut);
  const extras = stops.reduce((sum, s) => sum + (s.shots.length - 1), 0);
  let extraMs = cut.extraPhotoMs;
  const budget = cut.maxTotalMs - cut.endCardMs;
  const total = () =>
    cut.hookMs + cut.diveMs + n * cut.dwellMs + extras * extraMs + move.reduce((a, b) => a + b, 0) + cut.overviewMs + 150 + cut.doneDelayMs;

  // The hard limit (an Instagram story takes 60 s), end card included: the route's own budget is what is left. The hops give way first: the time a photo is on screen is what
  // makes the film readable. Only if that is not enough do the further photos of a stop get shorter.
  let over = total() - budget;
  if (over > 0) {
    const slack = move.reduce((sum, m) => sum + Math.max(0, m - HOP_FLOOR_MS), 0);
    const share = slack > 0 ? Math.min(1, over / slack) : 0;
    for (let i = 0; i < move.length; i++) move[i] = Math.floor(move[i]! - Math.max(0, move[i]! - HOP_FLOOR_MS) * share);
    over = total() - budget;
  }
  if (over > 0 && extras > 0) extraMs = Math.max(EXTRA_FLOOR_MS, extraMs - Math.ceil(over / extras));

  const arrive: number[] = [];
  const leave: number[] = [];
  const depart: number[] = [];
  const swaps: number[][] = [];
  for (let i = 0; i < n; i++) {
    const shots = stops[i]!.shots.length;
    arrive[i] = i === 0 ? cut.hookMs + cut.diveMs : depart[i - 1]! + move[i - 1]!;
    swaps[i] = [];
    for (let j = 1; j < shots; j++) swaps[i]!.push(arrive[i]! + cut.dwellMs + (j - 1) * extraMs);
    depart[i] = arrive[i]! + cut.dwellMs + (shots - 1) * extraMs;
    leave[i] = depart[i]! - cut.cardLeaveMs;
  }
  const overviewAt = n > 0 ? depart[n - 1]! : cut.hookMs + cut.diveMs;
  const hitAt = overviewAt + cut.overviewMs + 150;
  return { arrive, leave, depart, move, swaps, overviewAt, hitAt, titleAt: hitAt + cut.titleDelayMs, doneAt: hitAt + cut.doneDelayMs };
}

/** `timeline.doneAt + cut.endCardMs`. */
export function filmMs(timeline: Timeline, cut: FilmCut): number {
  return timeline.doneAt + cut.endCardMs;
}
