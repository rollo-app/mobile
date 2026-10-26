import { getActiveTripId } from "@/storage/active-trip";
import { setSessionToken } from "@/storage/session";
import { createTrip, deleteMedia, fetchFeed, fetchMyTrips, fetchTrip, joinTrip } from "../actions";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2027, 0, 5, 12, 0);

const trip = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Viaje al sur",
  joinCode: "HUB5FT",
  timezone: "America/Argentina/Buenos_Aires",
  startsAt: NOW,
  endsAt: NOW + 10 * DAY,
  revealAt: NOW + 10 * DAY,
  revealed: false,
  dailyPhotoLimit: 10,
  dailyVideoLimit: 3,
  photoLimitMode: "daily",
  totalPhotoLimit: null,
  momentMode: "off",
  momentWindowStart: 540,
  momentWindowEnd: 1380,
};
const member = { id: "m1", userId: "u1", name: "Juani", avatarUrl: null, role: "admin" };

function mockFetch(status: number, body?: unknown) {
  const fetchMock = jest.fn(async (_req: Request) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const lastReq = (fetchMock: jest.Mock) => fetchMock.mock.calls.at(-1)![0] as Request;
const sentBody = async (fetchMock: jest.Mock) => lastReq(fetchMock).json();

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
  await setSessionToken("session-tok");
});

afterEach(() => {
  jest.useRealTimers();
});

describe("fetchMyTrips", () => {
  it("requests /me/trips with the session token", async () => {
    const fetchMock = mockFetch(200, { trips: [] });

    expect(await fetchMyTrips()).toEqual({ trips: [] });
    expect(new URL(lastReq(fetchMock).url).pathname).toBe("/me/trips");
    expect(lastReq(fetchMock).headers.get("authorization")).toBe("Bearer session-tok");
  });
});

describe("createTrip", () => {
  const input = {
    name: "  Sur 2027 ",
    startsAt: NOW,
    endsAt: NOW + 10 * DAY,
    revealAt: NOW + 11 * DAY,
    photoLimit: { mode: "daily", perDay: 20 } as const,
    timezone: "America/Argentina/Buenos_Aires",
  };

  it("sends the configured dates and limits as they are, with no admin name", async () => {
    const fetchMock = mockFetch(201, { trip, member });

    await createTrip(input);

    expect(await sentBody(fetchMock)).toEqual({
      name: "Sur 2027",
      timezone: "America/Argentina/Buenos_Aires",
      startsAt: NOW,
      endsAt: NOW + 10 * DAY,
      revealAt: NOW + 11 * DAY,
      dailyPhotoLimit: 20,
      photoLimitMode: "daily",
    });
  });

  it("sends the total limit for the whole rollo, and no video limit", async () => {
    const fetchMock = mockFetch(201, { trip, member });

    await createTrip({ ...input, photoLimit: { mode: "total", total: 20 } });

    const body = await sentBody(fetchMock);
    expect(body).toMatchObject({ photoLimitMode: "total", totalPhotoLimit: 20 });
    expect(body).not.toHaveProperty("dailyVideoLimit");
  });

  it("makes the new trip the active one", async () => {
    mockFetch(201, { trip, member });

    const created = await createTrip(input);

    expect(created.id).toBe(trip.id);
    expect(await getActiveTripId()).toBe(trip.id);
  });

  it("if the server rejects, it propagates its message and keeps the active trip", async () => {
    mockFetch(400, { error: "El fin debe ser posterior al inicio" });

    await expect(createTrip(input)).rejects.toThrow("El fin debe ser posterior al inicio");
    expect(await getActiveTripId()).toBeNull();
  });
});

describe("joinTrip", () => {
  it("sends only the normalized code", async () => {
    const fetchMock = mockFetch(201, { trip, member });

    await joinTrip({ code: " hub5ft " });

    expect(await sentBody(fetchMock)).toEqual({ code: "HUB5FT" });
  });

  it("makes the trip active, also when you were already a member (200)", async () => {
    mockFetch(200, { trip, member });

    await joinTrip({ code: "HUB5FT" });

    expect(await getActiveTripId()).toBe(trip.id);
  });

  it("shows the server's message when the profile has no name yet", async () => {
    mockFetch(409, { error: "Completá tu nombre en el perfil" });

    await expect(joinTrip({ code: "HUB5FT" })).rejects.toThrow("Completá tu nombre en el perfil");
    expect(await getActiveTripId()).toBeNull();
  });
});

describe("fetchTrip", () => {
  it("uses the session token", async () => {
    const fetchMock = mockFetch(200, {
      trip,
      me: member,
      members: [],
      today: { date: "2027-01-05", photosLeft: 10, videosLeft: 3 },
      totalUploaded: 0,
    });

    const detail = await fetchTrip(trip.id);

    expect(detail.today.photosLeft).toBe(10);
    expect(lastReq(fetchMock).headers.get("authorization")).toBe("Bearer session-tok");
  });
});

describe("fetchFeed", () => {
  it("requests the trip feed and returns it", async () => {
    const feed = { revealed: false, revealAt: NOW, items: [] };
    const fetchMock = mockFetch(200, feed);

    expect(await fetchFeed(trip.id)).toEqual(feed);
    expect(new URL(lastReq(fetchMock).url).pathname).toBe(`/trips/${trip.id}/feed`);
    expect(lastReq(fetchMock).headers.get("authorization")).toBe("Bearer session-tok");
  });
});

describe("deleteMedia", () => {
  it("deletes the photo", async () => {
    const fetchMock = mockFetch(204);

    await deleteMedia("foto-1");

    expect(lastReq(fetchMock).method).toBe("DELETE");
    expect(new URL(lastReq(fetchMock).url).pathname).toBe("/media/foto-1");
  });

  it("if the server rejects, it throws its message", async () => {
    mockFetch(403, { error: "Solo el admin puede borrar" });

    await expect(deleteMedia("foto-1")).rejects.toThrow("Solo el admin puede borrar");
  });
});
