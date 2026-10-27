import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { queryClient } from "@/api/query-client";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { tripSummary } from "@/test/account";
import { clearSessionToken, setSessionToken } from "@/storage/session";
import { signOut } from "@/features/auth/session";
import { cancelMomentNotifications, syncMoments } from "../moment-sync";

const notifications = jest.mocked(Notifications);
const HOUR = 3_600_000;
const NOW = Date.UTC(2027, 0, 10, 12);

/** Fake scheduler: scheduling with an existing identifier replaces it. */
let store: Map<string, { identifier: string; trigger: { date: number } }>;
let moments: Record<string, { day: string; notifyAt: number }[]>;
let down: boolean;
let tripIds: string[];
let failing: Set<string>;
let gate: Promise<void> | null;
let modes: Record<string, "off" | "photo" | "photo_selfie">;

beforeEach(async () => {
  jest.clearAllMocks();
  queryClient.clear();
  jest.spyOn(Date, "now").mockReturnValue(NOW);
  await setSessionToken("tok");
  store = new Map();
  moments = { t1: [{ day: "2027-01-10", notifyAt: NOW + HOUR }, { day: "2027-01-11", notifyAt: NOW + 25 * HOUR }] };
  down = false;
  tripIds = ["t1"];
  failing = new Set();
  gate = null;
  modes = {};
  notifications.getAllScheduledNotificationsAsync.mockImplementation(async () => [...store.values()] as never);
  notifications.cancelScheduledNotificationAsync.mockImplementation(async (id) => void store.delete(id));
  notifications.scheduleNotificationAsync.mockImplementation((async (req: { identifier: string; trigger: { date: number } }) => {
    store.set(req.identifier, { identifier: req.identifier, trigger: req.trigger });
    return req.identifier;
  }) as never);
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  globalThis.fetch = jest.fn(async (req: Request) => {
    if (down) throw new TypeError("Network request failed");
    if (req.url.endsWith("/me/trips")) {
      return json({ trips: tripIds.map((id) => tripSummary(id, id === "t1" ? "Tandil" : id, { startsAt: NOW - HOUR, endsAt: NOW + 48 * HOUR, revealed: false, momentMode: modes[id] ?? "off" })) });
    }
    const id = /trips\/(\w+)\/moments/.exec(req.url)![1]!;
    if (gate) await gate;
    if (failing.has(id)) return new Response(JSON.stringify({ error: "boom" }), { status: 500, headers: { "content-type": "application/json" } });
    return json({ moments: moments[id] ?? [] });
  }) as unknown as typeof fetch;
});

afterEach(() => jest.restoreAllMocks());

describe("syncMoments", () => {
  it("reuses the cached list of rollos instead of asking /me/trips again", async () => {
    queryClient.setQueryData(myTripsKey, { trips: [tripSummary("t1", "Tandil", { startsAt: NOW - HOUR, endsAt: NOW + 48 * HOUR })] });
    await syncMoments();
    const urls = jest.mocked(globalThis.fetch).mock.calls.map(([req]) => (req as Request).url);
    expect(urls.filter((u) => u.endsWith("/me/trips"))).toHaveLength(0);
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it("schedules one notification per future moment at the exact instant, with id, copy and url", async () => {
    await syncMoments();

    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    const first = notifications.scheduleNotificationAsync.mock.calls[0]![0];
    expect(first).toEqual({
      identifier: "moment.t1.2027-01-10",
      content: {
        title: "Es tu momento",
        body: "Tenés 15 minutos para sacar tu foto de Tandil.",
        data: { url: `/moment?trip=t1&day=2027-01-10&at=${NOW + HOUR}&selfie=0` },
      },
      trigger: { type: "date", date: NOW + HOUR },
    });
  });

  it("puts selfie=1 in the url for a photo_selfie rollo and selfie=0 for a photo one", async () => {
    tripIds = ["t1", "t2"];
    modes = { t1: "photo_selfie", t2: "photo" };
    moments = { t1: [{ day: "2027-01-10", notifyAt: NOW + HOUR }], t2: [{ day: "2027-01-10", notifyAt: NOW + 2 * HOUR }] };
    await syncMoments();

    const urls = Object.fromEntries(notifications.scheduleNotificationAsync.mock.calls.map(([r]) => [r.identifier, (r.content.data as { url: string }).url]));
    expect(urls["moment.t1.2027-01-10"]).toBe(`/moment?trip=t1&day=2027-01-10&at=${NOW + HOUR}&selfie=1`);
    expect(urls["moment.t2.2027-01-10"]).toBe(`/moment?trip=t2&day=2027-01-10&at=${NOW + 2 * HOUR}&selfie=0`);
  });

  it("does not duplicate on a second run and cancels a moment that is gone", async () => {
    await syncMoments();
    await syncMoments();
    expect([...store.keys()]).toEqual(["moment.t1.2027-01-10", "moment.t1.2027-01-11"]);

    moments.t1 = [moments.t1![0]!];
    await syncMoments();
    expect([...store.keys()]).toEqual(["moment.t1.2027-01-10"]);
  });

  it("leaves what is scheduled alone when the network is down", async () => {
    await syncMoments();
    down = true;
    await expect(syncMoments()).resolves.toBeUndefined();
    expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(store.size).toBe(2);
  });

  it("keeps the times out of the query cache and SecureStore", async () => {
    await syncMoments();
    expect(JSON.stringify(queryClient.getQueryCache().getAll().map((q) => q.state.data))).not.toContain(String(NOW + HOUR));
    const stored = jest.mocked(SecureStore.setItemAsync).mock.calls.map((c) => c[1]).join("|");
    expect(stored).not.toContain(String(NOW + HOUR));
  });
});

describe("syncMoments with several rollos and races", () => {
  const at = (n: number) => [{ day: "2027-01-10", notifyAt: NOW + n * HOUR }];
  const ids = () => [...store.keys()].sort();

  it("a failing rollo keeps its scheduled notifications and doesn't stop the others", async () => {
    tripIds = ["t1", "t2"];
    moments = { t1: at(1), t2: at(2) };
    await syncMoments();
    moments = { t1: at(3), t2: at(4) };
    failing = new Set(["t1"]);
    await syncMoments();

    expect(store.get("moment.t1.2027-01-10")!.trigger.date).toBe(NOW + HOUR);
    expect(store.get("moment.t2.2027-01-10")!.trigger.date).toBe(NOW + 4 * HOUR);
  });

  it("logout in the middle of a sync leaves zero moment notifications", async () => {
    let release!: () => void;
    gate = new Promise<void>((r) => (release = r));
    const sync = syncMoments();
    await new Promise((r) => setTimeout(r, 20));
    await clearSessionToken();
    const cancel = cancelMomentNotifications();
    release();
    await Promise.all([sync, cancel]);

    expect(ids()).toEqual([]);
  });

  it("cancelling and signing out resolve promptly while a moments fetch hangs forever", async () => {
    store.set("moment.t1.2027-01-09", { identifier: "moment.t1.2027-01-09", trigger: { date: 1 } });
    gate = new Promise<void>(() => {});
    void syncMoments();
    await new Promise((r) => setTimeout(r, 20));
    const timeout = new Promise((r) => setTimeout(() => r("timeout"), 500));

    expect(await Promise.race([cancelMomentNotifications().then(() => "done"), timeout])).toBe("done");
    expect(await Promise.race([signOut().then(() => "done"), timeout])).toBe("done");
    expect(ids()).toEqual([]);
  });

  it("leaving a rollo in the middle of a sync leaves none for that rollo", async () => {
    tripIds = ["t1", "t2"];
    moments = { t1: at(1), t2: at(2) };
    let release!: () => void;
    gate = new Promise<void>((r) => (release = r));
    const sync = syncMoments();
    await new Promise((r) => setTimeout(r, 20));
    const cancel = cancelMomentNotifications("t1");
    release();
    await Promise.all([sync, cancel]);

    expect(ids()).toEqual(["moment.t2.2027-01-10"]);
  });
});

describe("cancelMomentNotifications", () => {
  beforeEach(() => {
    for (const identifier of ["moment.t1.d1", "moment.t2.d1", "reveal.t1", "other"]) store.set(identifier, { identifier, trigger: { date: 1 } });
  });

  it("cancels every moment.* and nothing else", async () => {
    await cancelMomentNotifications();
    expect([...store.keys()]).toEqual(["reveal.t1", "other"]);
  });

  it("also dismisses the already delivered moment.* notifications (so the next account can't tap them)", async () => {
    notifications.getPresentedNotificationsAsync.mockResolvedValue([
      { request: { identifier: "moment.t1.d0" } },
      { request: { identifier: "friend.1" } },
    ] as never);
    await signOut();

    expect(notifications.dismissNotificationAsync).toHaveBeenCalledTimes(1);
    expect(notifications.dismissNotificationAsync).toHaveBeenCalledWith("moment.t1.d0");
    notifications.getPresentedNotificationsAsync.mockResolvedValue([]);
  });

  it("cancels only one trip's moments when given a trip", async () => {
    await cancelMomentNotifications("t1");
    expect([...store.keys()]).toEqual(["moment.t2.d1", "reveal.t1", "other"]);
  });
});
