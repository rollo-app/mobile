import { OfflineManager, type OfflinePack } from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import * as Network from "expo-network";
import { Appearance } from "react-native";
import { queryClient } from "@/api/query-client";
import { fetchFeed, fetchTrip } from "@/features/trips/actions";
import { feedKey } from "@/features/trips/use-feed";
import { tripKey } from "@/features/trips/use-trip-detail";
import { listTrips } from "@/storage/trips";
import { downloadRegion, resumeRegion, type LngLat } from "./offline";
import {
  inDownloadWindow,
  networkAllows,
  packExpiresAt,
  packInfoFromMetadata,
  planDownloads,
  selectExpired,
  type Connection,
  type PackInfo,
  type Place,
  type PlanTrip,
} from "./offline-plan";
import type { OfflineMapState } from "./offline-status";
import { silenceTileNetworkErrors } from "./log-filter";
import { writeStyleFile } from "./style-file";

silenceTileNetworkErrors();

const DEBOUNCE_MS = 1500;

type SyncState = Pick<OfflineMapState, "running" | "percent" | "waitingForWifi">;

let state: SyncState = { running: false, percent: null, waitingForWifi: false };
const subscribers = new Set<() => void>();

export const getOfflineSyncState = () => state;

export function subscribeOfflineSync(listener: () => void) {
  subscribers.add(listener);
  return () => void subscribers.delete(listener);
}

function setState(next: Partial<SyncState>) {
  state = { ...state, ...next };
  subscribers.forEach((listener) => listener());
}

async function readConnection(): Promise<Connection> {
  try {
    const net = await Network.getNetworkStateAsync();
    return { connected: !!net.isConnected && net.isInternetReachable !== false, wifi: net.type === Network.NetworkStateType.WIFI };
  } catch {
    return { connected: false, wifi: false };
  }
}

/** The last known position is enough: there's no need to wait for a new fix. */
async function readLocation(): Promise<LngLat | null> {
  try {
    const { granted } = await Location.getForegroundPermissionsAsync();
    if (!granted) return null;
    const position = await Location.getLastKnownPositionAsync();
    return position ? [position.coords.longitude, position.coords.latitude] : null;
  } catch {
    return null;
  }
}

/** Fresh data when there is a connection; otherwise (or if the request fails) whatever is cached. */
async function cachedOrFetched<T>(key: readonly unknown[], fetcher: () => Promise<T>, online: boolean): Promise<T | null> {
  if (online) {
    try {
      return await queryClient.fetchQuery({ queryKey: key, queryFn: fetcher });
    } catch {
      // fall through to the cache
    }
  }
  return queryClient.getQueryData<T>(key) ?? null;
}

type KnownTrip = { trip: PlanTrip; photos: Place[] };

async function loadTrips(tripIds: string[], online: boolean): Promise<KnownTrip[]> {
  const known: KnownTrip[] = [];
  for (const tripId of tripIds) {
    const detail = await cachedOrFetched(tripKey(tripId), () => fetchTrip(tripId), online);
    if (!detail) continue;
    const { startsAt, endsAt, revealed } = detail.trip;
    const feed = await cachedOrFetched(feedKey(tripId), () => fetchFeed(tripId), online);
    const photos = (feed?.items ?? []).flatMap((i) =>
      i.lat === null || i.lng === null ? [] : [{ lat: i.lat, lng: i.lng, takenAt: i.takenAt }],
    );
    known.push({ trip: { tripId, startsAt, endsAt, revealed }, photos });
  }
  return known;
}

type StoredPack = { pack: OfflinePack; info: PackInfo; complete: boolean };

async function readPacks(): Promise<StoredPack[]> {
  const stored: StoredPack[] = [];
  for (const pack of await OfflineManager.getPacks()) {
    const status = await pack.status();
    const info = packInfoFromMetadata(pack.id, pack.metadata, status.completedResourceSize);
    if (info) stored.push({ pack, info, complete: status.state === "complete" });
  }
  return stored;
}

/** What is on the phone, for the "Mapa sin señal" screen. */
export async function readOfflineSummary() {
  const stored = await readPacks();
  return {
    packs: stored.map((s) => s.info),
    bytes: stored.reduce((sum, s) => sum + s.info.bytes, 0),
    incomplete: stored.filter((s) => !s.complete).length,
  };
}

async function run(): Promise<void> {
  const now = Date.now();
  const saved = await listTrips();
  const net = await readConnection();
  const known = await loadTrips(saved.map((t) => t.tripId), net.connected);
  const endsAtByTrip = new Map(known.map((k) => [k.trip.tripId, k.trip.endsAt]));

  // Housekeeping first: it needs no connection.
  let stored = await readPacks();
  const expired = selectExpired(stored.map((s) => s.info), endsAtByTrip, new Set(saved.map((t) => t.tripId)), now);
  for (const { id } of expired) await OfflineManager.deletePack(id);
  stored = stored.filter((s) => !expired.some((e) => e.id === s.info.id));
  if (expired.length > 0) {
    // A roll whose dates we don't know counts as current: better to keep the cache than to lose it.
    const anyCurrent = saved.some((t) => {
      const endsAt = endsAtByTrip.get(t.tripId);
      return endsAt === undefined || now < packExpiresAt(endsAt);
    });
    if (!anyCurrent) await OfflineManager.clearAmbientCache();
  }

  if (!net.connected) {
    setState({ waitingForWifi: false });
    return;
  }

  const open = known.filter((k) => inDownloadWindow(k.trip, now));
  const allowed = open.filter((k) => networkAllows(k.trip, net, now));
  setState({ waitingForWifi: allowed.length < open.length });
  if (allowed.length === 0) return;

  const allowedIds = new Set(allowed.map((k) => k.trip.tripId));
  const toResume = stored.filter((s) => !s.complete && allowedIds.has(s.info.tripId));
  const zones = planDownloads({
    trips: allowed,
    existing: stored.map((s) => s.info),
    location: await readLocation(),
  });

  const total = toResume.length + zones.length;
  if (total === 0) return;

  // The map shows the same file the pack was downloaded with, or the downloaded tiles aren't found.
  const mapStyle = writeStyleFile(Appearance.getColorScheme() === "dark" ? "dark" : "light");
  let done = 0;
  const report = (percentage: number) => setState({ running: true, percent: ((done + percentage / 100) / total) * 100 });
  report(0);

  for (const { pack } of toResume) {
    await resumeRegion(pack, (s) => report(s.percentage));
    report(100);
    done += 1;
  }
  for (const zone of zones) {
    await downloadRegion(
      {
        mapStyle,
        center: zone.center,
        radiusKm: zone.radiusKm,
        minZoom: zone.minZoom,
        maxZoom: zone.maxZoom,
        metadata: {
          name: zone.name,
          tripId: zone.tripId,
          kind: zone.kind,
          center: zone.center,
          radiusKm: zone.radiusKm,
          expiresAt: zone.expiresAt,
        },
      },
      (s) => report(s.percentage),
    );
    done += 1;
  }
}

let current: Promise<void> | null = null;

/**
 * Downloads and cleans up offline maps. One run at a time: asking again while one is running joins it.
 * A failure (signal lost mid-download) just ends the run; the next one resumes the unfinished packs.
 */
export function syncOfflineMaps(): Promise<void> {
  current ??= run()
    .catch(() => {})
    .finally(() => {
      current = null;
      setState({ running: false, percent: null });
    });
  return current;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** For the triggers (app open, back to foreground): several in a row become a single run. */
export function scheduleOfflineSync() {
  clearTimeout(timer);
  timer = setTimeout(() => void syncOfflineMaps(), DEBOUNCE_MS);
}
