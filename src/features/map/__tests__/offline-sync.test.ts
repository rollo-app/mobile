import { OfflineManager } from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import * as Network from "expo-network";
import { queryClient } from "@/api/query-client";
import { fetchFeed, fetchTrip } from "@/features/trips/actions";
import { myTripsKey } from "@/features/trips/use-active-trip";
import type { TripSummary } from "@/features/trips/active";
import { signInAs, tripSummary } from "@/test/account";
import { buildMapStyle } from "../style";
import { getOfflineSyncState, scheduleOfflineSync, syncOfflineMaps } from "../offline-sync";

jest.mock("@/features/trips/actions", () => ({ fetchTrip: jest.fn(), fetchFeed: jest.fn() }));

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2027, 0, 12, 15);
const START = NOW - DAY;
const END = NOW + 5 * DAY;
const CHALTEN = { latitude: -49.33, longitude: -72.89 };

type FakePack = { id: string; metadata: Record<string, unknown>; state: "complete" | "inactive"; size: number };
let packs: FakePack[];
let nextId: number;
let gate: Promise<void> | null;

const asNative = (p: FakePack) => ({
  id: p.id,
  metadata: p.metadata,
  status: async () => ({ id: p.id, state: p.state, percentage: p.state === "complete" ? 100 : 40, completedResourceSize: p.size }),
  resume: jest.fn(async () => {
    p.state = "complete";
    for (const l of listeners.get(p.id) ?? []) l(asNative(p), { id: p.id, state: "complete", percentage: 100, completedResourceSize: p.size });
  }),
});
const listeners = new Map<string, ((pack: unknown, status: unknown) => void)[]>();

const meta = (tripId: string, kind: "wide" | "detail", extra: Record<string, unknown> = {}) => ({
  name: `rollo:${tripId}:${kind}:-49.33,-72.89`,
  center: [CHALTEN.longitude, CHALTEN.latitude],
  radiusKm: kind === "wide" ? 300 : 40,
  expiresAt: END + 7 * DAY,
  ...extra,
});

/** The dates and state of a roll come from the `/me/trips` summary, which is already in the cache. */
const setTrip = (tripId: string, over: Partial<TripSummary> = {}) => {
  const mine = queryClient.getQueryData<{ trips: TripSummary[] }>(myTripsKey)!.trips;
  const next = mine.map((t) => (t.id === tripId ? { ...t, ...over } : t));
  queryClient.setQueryData(myTripsKey, { trips: next });
};

const network = (type: string, isConnected = true) =>
  jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({ type, isConnected, isInternetReachable: isConnected } as never);

const created = () => jest.mocked(OfflineManager.createPack).mock.calls;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
  packs = [];
  nextId = 1;
  gate = null;
  listeners.clear();
  queryClient.clear();
  jest.clearAllMocks();

  await signInAs({ trips: [tripSummary("t1", "Viaje al sur", { role: "admin", startsAt: START, endsAt: END })] });
  jest.mocked(fetchFeed).mockResolvedValue({ items: [] } as never);
  network("WIFI");
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({ granted: true } as never);
  jest.mocked(Location.getLastKnownPositionAsync).mockResolvedValue({ coords: { ...CHALTEN, accuracy: 20 } } as never);

  jest.mocked(OfflineManager.getPacks).mockImplementation(async () => packs.map(asNative) as never);
  jest.mocked(OfflineManager.deletePack).mockImplementation(async (id) => {
    packs = packs.filter((p) => p.id !== id);
  });
  jest.mocked(OfflineManager.addListener).mockImplementation(async (id, progress) => {
    listeners.set(id, [...(listeners.get(id) ?? []), progress as never]);
  });
  jest.mocked(OfflineManager.createPack).mockImplementation((async (options: { metadata: Record<string, unknown> }, progress: Function) => {
    const pack: FakePack = { id: `p${nextId++}`, metadata: options.metadata, state: "inactive", size: 5_000_000 };
    packs.push(pack);
    void Promise.resolve(gate).then(() => {
      pack.state = "complete";
      progress(asNative(pack), { id: pack.id, state: "complete", percentage: 100, completedResourceSize: pack.size });
    });
    return asNative(pack);
  }) as never);
});

afterEach(() => jest.useRealTimers());

describe("syncOfflineMaps", () => {
  it("downloads a wide and a detailed zone around the last known location", async () => {
    await syncOfflineMaps();
    expect(created().map(([o]) => [o.metadata!.name, o.minZoom, o.maxZoom])).toEqual([
      ["rollo:t1:wide:-49.33,-72.89", 5, 10],
      ["rollo:t1:detail:-49.33,-72.89", 10, 14],
    ]);
    expect(created()[0]![0].metadata!.expiresAt).toBe(END + 7 * DAY);
  });

  it("downloads with the exact style URL the map uses", async () => {
    await syncOfflineMaps();
    for (const [options] of created()) expect(options.mapStyle).toBe("file:///docs/map/style-light.json");
  });

  it("does not download again what is already covered", async () => {
    await syncOfflineMaps();
    await syncOfflineMaps();
    expect(created()).toHaveLength(2);
  });

  it("downloads the places where the group took photos", async () => {
    jest.mocked(fetchFeed).mockResolvedValue({ items: [{ lat: -50.34, lng: -72.28, takenAt: NOW - 1000 }, { lat: null, lng: null, takenAt: 1 }] } as never);
    await syncOfflineMaps();
    expect(created().map(([o]) => o.metadata!.name)).toContain("rollo:t1:detail:-50.34,-72.28");
  });

  it("downloads one zone at a time", async () => {
    let release!: () => void;
    gate = new Promise((resolve) => (release = resolve));
    const run = syncOfflineMaps();
    await jest.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(created()).toHaveLength(1);
    release();
    await run;
    expect(created()).toHaveLength(2);
  });

  it("runs once even when asked twice at the same time", async () => {
    await Promise.all([syncOfflineMaps(), syncOfflineMaps()]);
    expect(created()).toHaveLength(2);
  });

  it("debounces the triggers", async () => {
    scheduleOfflineSync();
    scheduleOfflineSync();
    scheduleOfflineSync();
    await jest.advanceTimersByTimeAsync(5000);
    for (let i = 0; i < 50; i++) await Promise.resolve();
    expect(created()).toHaveLength(2);
  });

  it("deletes expired packs and clears the ambient cache when no roll is current", async () => {
    setTrip("t1", { startsAt: NOW - 30 * DAY, endsAt: NOW - 8 * DAY });
    packs = [{ id: "old", metadata: meta("t1", "detail", { expiresAt: NOW - DAY }), state: "complete", size: 1 }];
    await syncOfflineMaps();
    expect(OfflineManager.deletePack).toHaveBeenCalledWith("old");
    expect(OfflineManager.clearAmbientCache).toHaveBeenCalled();
    expect(created()).toHaveLength(0);
  });

  it("keeps the ambient cache while another roll is current", async () => {
    await signInAs({
      trips: [
        tripSummary("t1", "Viejo", { startsAt: NOW - 30 * DAY, endsAt: NOW - 8 * DAY, revealed: true }),
        tripSummary("t2", "Otro", { role: "member", startsAt: START, endsAt: END }),
      ],
    });
    packs = [{ id: "old", metadata: meta("t1", "detail"), state: "complete", size: 1 }];
    await syncOfflineMaps();
    expect(OfflineManager.deletePack).toHaveBeenCalledWith("old");
    expect(OfflineManager.clearAmbientCache).not.toHaveBeenCalled();
  });

  it("keeps a pack until 7 days after the end", async () => {
    setTrip("t1", { startsAt: NOW - 30 * DAY, endsAt: NOW - 6 * DAY, revealed: true });
    packs = [{ id: "keep", metadata: meta("t1", "detail", { expiresAt: NOW + DAY }), state: "complete", size: 1 }];
    await syncOfflineMaps();
    expect(OfflineManager.deletePack).not.toHaveBeenCalled();
  });

  it("waits for Wi-Fi before the roll starts", async () => {
    setTrip("t1", { startsAt: NOW + 2 * DAY, endsAt: NOW + 9 * DAY });
    network("CELLULAR");
    await syncOfflineMaps();
    expect(created()).toHaveLength(0);
    expect(getOfflineSyncState().waitingForWifi).toBe(true);

    network("WIFI");
    await syncOfflineMaps();
    expect(created()).toHaveLength(2);
    expect(getOfflineSyncState().waitingForWifi).toBe(false);
  });

  it("uses cellular once the roll has started", async () => {
    network("CELLULAR");
    await syncOfflineMaps();
    expect(created()).toHaveLength(2);
  });

  it("does nothing more than cleaning up without a connection", async () => {
    network("NONE", false);
    packs = [{ id: "old", metadata: meta("t1", "detail", { expiresAt: NOW - DAY }), state: "complete", size: 1 }];
    setTrip("t1", { startsAt: NOW - 30 * DAY, endsAt: NOW - 8 * DAY });
    await syncOfflineMaps();
    expect(created()).toHaveLength(0);
    expect(fetchTrip).not.toHaveBeenCalled();
  });

  it("only asks the server for the feed of rolls in the download window, never for the detail", async () => {
    await signInAs({
      trips: [
        tripSummary("t1", "En curso", { startsAt: START, endsAt: END }),
        tripSummary("old", "Revelado", { startsAt: NOW - 30 * DAY, endsAt: NOW - 8 * DAY, revealed: true }),
        tripSummary("future", "Lejano", { startsAt: NOW + 10 * DAY, endsAt: NOW + 20 * DAY }),
      ],
    });
    await syncOfflineMaps();
    expect(fetchFeed).toHaveBeenCalledTimes(1);
    expect(fetchFeed).toHaveBeenCalledWith("t1");
    expect(fetchTrip).not.toHaveBeenCalled();
  });

  it("takes the pack expiry from the summary dates when the cache has no detail", async () => {
    setTrip("t1", { startsAt: NOW - 30 * DAY, endsAt: NOW - 8 * DAY, revealed: true });
    packs = [{ id: "old", metadata: meta("t1", "detail", { expiresAt: NOW + 30 * DAY }), state: "complete", size: 1 }];
    await syncOfflineMaps();
    expect(OfflineManager.deletePack).toHaveBeenCalledWith("old");
    expect(fetchFeed).not.toHaveBeenCalled();
  });

  it("does not download for revealed rolls or rolls far in the future", async () => {
    setTrip("t1", { revealed: true });
    await syncOfflineMaps();
    setTrip("t1", { startsAt: NOW + 10 * DAY, endsAt: NOW + 20 * DAY });
    await syncOfflineMaps();
    expect(created()).toHaveLength(0);
  });

  it("resumes an interrupted pack instead of creating it again", async () => {
    packs = [
      { id: "half", metadata: meta("t1", "wide"), state: "inactive", size: 1 },
      { id: "done", metadata: meta("t1", "detail"), state: "complete", size: 1 },
    ];
    await syncOfflineMaps();
    expect(packs.find((p) => p.id === "half")!.state).toBe("complete");
    expect(created()).toHaveLength(0);
  });

  it("only plans photo places when there is no location", async () => {
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({ granted: false } as never);
    await syncOfflineMaps();
    expect(created()).toHaveLength(0);
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("stops the run when a download fails and tries again next time", async () => {
    jest.mocked(OfflineManager.createPack).mockRejectedValueOnce(new Error("boom"));
    await expect(syncOfflineMaps()).resolves.toBeUndefined();
    expect(created()).toHaveLength(1);
    expect(getOfflineSyncState().running).toBe(false);
    await syncOfflineMaps();
    expect(created()).toHaveLength(3);
  });
});

describe("map style", () => {
  it("is the same for both schemes except for colors, so downloaded tiles serve both", () => {
    const light = buildMapStyle("light") as unknown as Record<string, unknown>;
    const dark = buildMapStyle("dark") as unknown as Record<string, unknown>;
    expect(dark.sources).toEqual(light.sources);
    expect(dark.glyphs).toEqual(light.glyphs);
    expect(dark.sprite).toEqual(light.sprite);
  });
});
