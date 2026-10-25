import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { queryClient } from "@/api/query-client";
import { tripSummary } from "@/test/account";
import { setSessionToken } from "@/storage/session";
import { cancelMomentNotifications, syncMoments } from "../moment-sync";

const notifications = jest.mocked(Notifications);
const HOUR = 3_600_000;
const NOW = Date.UTC(2027, 0, 10, 12);

/** Fake scheduler: scheduling with an existing identifier replaces it. */
let store: Map<string, { identifier: string; trigger: { date: number } }>;
let moments: Record<string, { day: string; notifyAt: number }[]>;
let down: boolean;

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(Date, "now").mockReturnValue(NOW);
  await setSessionToken("tok");
  store = new Map();
  moments = { t1: [{ day: "2027-01-10", notifyAt: NOW + HOUR }, { day: "2027-01-11", notifyAt: NOW + 25 * HOUR }] };
  down = false;
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
      return json({ trips: [tripSummary("t1", "Tandil", { startsAt: NOW - HOUR, endsAt: NOW + 48 * HOUR, revealed: false })] });
    }
    const id = /trips\/(\w+)\/moments/.exec(req.url)![1]!;
    return json({ moments: moments[id] ?? [] });
  }) as unknown as typeof fetch;
});

afterEach(() => jest.restoreAllMocks());

describe("syncMoments", () => {
  it("schedules one notification per future moment at the exact instant, with id, copy and url", async () => {
    await syncMoments();

    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    const first = notifications.scheduleNotificationAsync.mock.calls[0]![0];
    expect(first).toEqual({
      identifier: "moment.t1.2027-01-10",
      content: {
        title: "Es tu momento",
        body: "Tenés 5 minutos para sacar tu foto de Tandil.",
        data: { url: `/moment?trip=t1&day=2027-01-10&at=${NOW + HOUR}` },
      },
      trigger: { type: "date", date: NOW + HOUR },
    });
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

describe("cancelMomentNotifications", () => {
  beforeEach(() => {
    for (const identifier of ["moment.t1.d1", "moment.t2.d1", "reveal.t1", "other"]) store.set(identifier, { identifier, trigger: { date: 1 } });
  });

  it("cancels every moment.* and nothing else", async () => {
    await cancelMomentNotifications();
    expect([...store.keys()]).toEqual(["reveal.t1", "other"]);
  });

  it("cancels only one trip's moments when given a trip", async () => {
    await cancelMomentNotifications("t1");
    expect([...store.keys()]).toEqual(["moment.t2.d1", "reveal.t1", "other"]);
  });
});
