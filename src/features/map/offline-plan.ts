import type { LngLat } from "./offline";

/**
 * What to download for use without signal, and what to throw away. Pure logic: the sync
 * (offline-sync.ts) feeds it with the saved rolls, the group's photos and the packs already on the phone.
 */

const DAY = 24 * 60 * 60 * 1000;
const MB = 1_000_000;

/** Downloads start this long before the roll does (packing time) and stop when it ends. */
const WINDOW_LEAD = 3 * DAY;
/** A pack is kept this long after the roll ends. */
const PACK_TTL = 7 * DAY;
export const TOTAL_CAP_BYTES = 400 * MB;
/** Photos closer than this share one detailed zone. */
const PLACE_CELL_KM = 30;
/** A new zone is skipped when its center is within this fraction of an existing zone's radius. */
const COVER_FRACTION = 0.5;

export type ZoneKind = "wide" | "detail";

export const ZONE_SPECS = {
  wide: { radiusKm: 300, minZoom: 5, maxZoom: 10, estimatedBytes: 3 * MB },
  // Measured: 40 km at zoom 10-14 is ~9.5 MB.
  detail: { radiusKm: 40, minZoom: 10, maxZoom: 14, estimatedBytes: 10 * MB },
} as const;

export type PlanTrip = { tripId: string; startsAt: number; endsAt: number; revealed: boolean };
export type Place = { lat: number; lng: number; takenAt: number };
export type Zone = {
  name: string;
  tripId: string;
  kind: ZoneKind;
  center: LngLat;
  radiusKm: number;
  minZoom: number;
  maxZoom: number;
  expiresAt: number;
  estimatedBytes: number;
  /** When the newest photo of the place was taken (0 for the person's own location). */
  newestAt: number;
};
/** A pack already on the phone, read back from its metadata. */
export type PackInfo = {
  id: string;
  tripId: string;
  kind: ZoneKind;
  center: LngLat;
  radiusKm: number;
  expiresAt: number;
  bytes: number;
};

export function inDownloadWindow(trip: PlanTrip, now: number): boolean {
  return !trip.revealed && now >= trip.startsAt - WINDOW_LEAD && now < trip.endsAt;
}

export const packExpiresAt = (endsAt: number) => endsAt + PACK_TTL;

export function distanceKm([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

const round = (n: number) => Math.round(n * 100) / 100;

/** `rollo:{tripId}:{wide|detail}:{lat},{lng}` — the name says which roll a pack belongs to. */
export function packName(tripId: string, kind: ZoneKind, [lng, lat]: LngLat): string {
  return `rollo:${tripId}:${kind}:${round(lat)},${round(lng)}`;
}

export function parsePackName(name: string): { tripId: string; kind: ZoneKind; center: LngLat } | null {
  const match = /^rollo:([^:]+):(wide|detail):(-?[\d.]+),(-?[\d.]+)$/.exec(name);
  if (!match) return null;
  return { tripId: match[1]!, kind: match[2] as ZoneKind, center: [Number(match[4]), Number(match[3])] };
}

/** Reads one of our packs from its stored metadata; null for anything else. */
export function packInfoFromMetadata(id: string, metadata: Record<string, unknown>, bytes: number): PackInfo | null {
  const parsed = typeof metadata.name === "string" ? parsePackName(metadata.name) : null;
  if (!parsed || typeof metadata.radiusKm !== "number" || typeof metadata.expiresAt !== "number") return null;
  const center = Array.isArray(metadata.center) ? (metadata.center as LngLat) : parsed.center;
  return { id, ...parsed, center, radiusKm: metadata.radiusKm, expiresAt: metadata.expiresAt, bytes };
}

/** Collapses photos onto a ~30 km grid: one place per cell, at the cell's centroid. */
export function groupPlaces(photos: Place[]): { center: LngLat; takenAt: number }[] {
  const cells = new Map<string, { lat: number; lng: number; n: number; takenAt: number }>();
  const dLat = PLACE_CELL_KM / 111.32;
  for (const p of photos) {
    const row = Math.floor(p.lat / dLat);
    const dLng = PLACE_CELL_KM / (111.32 * Math.max(Math.cos(((row + 0.5) * dLat * Math.PI) / 180), 0.01));
    const key = `${row}:${Math.floor(p.lng / dLng)}`;
    const cell = cells.get(key) ?? { lat: 0, lng: 0, n: 0, takenAt: 0 };
    cells.set(key, { lat: cell.lat + p.lat, lng: cell.lng + p.lng, n: cell.n + 1, takenAt: Math.max(cell.takenAt, p.takenAt) });
  }
  return [...cells.values()].map((c) => ({ center: [c.lng / c.n, c.lat / c.n], takenAt: c.takenAt }));
}

function zone(trip: PlanTrip, kind: ZoneKind, center: LngLat, newestAt: number): Zone {
  const spec = ZONE_SPECS[kind];
  return {
    name: packName(trip.tripId, kind, center),
    tripId: trip.tripId,
    kind,
    center,
    radiusKm: spec.radiusKm,
    minZoom: spec.minZoom,
    maxZoom: spec.maxZoom,
    expiresAt: packExpiresAt(trip.endsAt),
    estimatedBytes: spec.estimatedBytes,
    newestAt,
  };
}

const covers = (existing: { tripId: string; kind: ZoneKind; center: LngLat; radiusKm: number }, z: Zone) =>
  existing.tripId === z.tripId &&
  existing.kind === z.kind &&
  distanceKm(existing.center, z.center) <= existing.radiusKm * COVER_FRACTION;

/**
 * The zones still missing, in download order, trimmed to the total cap. The wide zones go first
 * (cheap), then the detailed ones closest to the person, or the newest when there is no location.
 */
export function planDownloads(input: {
  trips: { trip: PlanTrip; photos: Place[] }[];
  existing: PackInfo[];
  location: LngLat | null;
  capBytes?: number;
}): Zone[] {
  const { trips, existing, location, capBytes = TOTAL_CAP_BYTES } = input;

  const wanted: Zone[] = [];
  for (const { trip, photos } of trips) {
    if (location) wanted.push(zone(trip, "wide", location, 0), zone(trip, "detail", location, 0));
    for (const place of groupPlaces(photos)) wanted.push(zone(trip, "detail", place.center, place.takenAt));
  }

  const rank = (z: Zone) => (z.kind === "wide" ? 0 : 1);
  const far = (z: Zone) => (location ? distanceKm(location, z.center) : 0);
  wanted.sort((a, b) => rank(a) - rank(b) || far(a) - far(b) || b.newestAt - a.newestAt);

  let total = existing.reduce((sum, p) => sum + p.bytes, 0);
  const accepted: Zone[] = [];
  for (const z of wanted) {
    if (existing.some((p) => covers(p, z)) || accepted.some((a) => covers(a, z))) continue;
    if (total + z.estimatedBytes > capBytes) continue;
    total += z.estimatedBytes;
    accepted.push(z);
  }
  return accepted;
}

/**
 * Packs to delete: the ones past their expiry, and those of rolls the person left. The roll's end
 * (when known) wins over the expiry stored with the pack, in case the admin changed the dates.
 */
export function selectExpired(
  packs: PackInfo[],
  endsAtByTrip: Map<string, number>,
  savedTripIds: Set<string>,
  now: number,
): PackInfo[] {
  return packs.filter((p) => {
    if (!savedTripIds.has(p.tripId)) return true;
    const endsAt = endsAtByTrip.get(p.tripId);
    return now >= (endsAt === undefined ? p.expiresAt : packExpiresAt(endsAt));
  });
}

export type Connection = { connected: boolean; wifi: boolean };

/** Before the roll starts only Wi-Fi is used; from the start on, any connection. */
export function networkAllows(trip: PlanTrip, net: Connection, now: number): boolean {
  if (!net.connected) return false;
  return now >= trip.startsAt || net.wifi;
}
