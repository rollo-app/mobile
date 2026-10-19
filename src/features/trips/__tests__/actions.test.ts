import { getToken, listTrips, saveSession } from "@/storage/trips";
import { createTrip, deleteMedia, fetchFeed, fetchTrip, joinTrip, joinWithToken, renameMe } from "../actions";

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
};

function mockFetch(status: number, body: unknown) {
  const fetchMock = jest.fn(async (_req: Request) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const sentBody = async (fetchMock: jest.Mock) => (fetchMock.mock.calls.at(-1)![0] as Request).json();

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("createTrip", () => {
  it("starts today, lasts the given days and is revealed at the end", async () => {
    const fetchMock = mockFetch(201, { trip, member: { id: "m1", name: "Juani", role: "admin" }, token: "tok" });

    await createTrip({ name: "  Viaje al sur ", adminName: " Juani ", days: 10, timezone: "America/Argentina/Buenos_Aires" });

    expect(await sentBody(fetchMock)).toEqual({
      name: "Viaje al sur",
      adminName: "Juani",
      timezone: "America/Argentina/Buenos_Aires",
      startsAt: NOW,
      endsAt: NOW + 10 * DAY,
      revealAt: NOW + 10 * DAY,
    });
  });

  it("saves the session with the admin token", async () => {
    mockFetch(201, { trip, member: { id: "m1", name: "Juani", role: "admin" }, token: "tok-admin" });

    const created = await createTrip({ name: "Viaje al sur", adminName: "Juani", days: 10, timezone: "UTC" });

    expect(created.id).toBe(trip.id);
    expect(await getToken(trip.id)).toBe("tok-admin");
    expect(await listTrips()).toEqual([
      expect.objectContaining({ tripId: trip.id, joinCode: "HUB5FT", memberName: "Juani", role: "admin" }),
    ]);
  });
});

describe("joinTrip", () => {
  it("normalizes code and name before sending them", async () => {
    const fetchMock = mockFetch(201, { trip, member: { id: "m2", name: "Fede", role: "member" }, token: "tok" });

    await joinTrip({ code: " hub5ft ", name: " Fede " });

    expect(await sentBody(fetchMock)).toEqual({ code: "HUB5FT", name: "Fede" });
  });

  it("saves the session as a member", async () => {
    mockFetch(201, { trip, member: { id: "m2", name: "Fede", role: "member" }, token: "tok-fede" });

    await joinTrip({ code: "HUB5FT", name: "Fede" });

    expect(await getToken(trip.id)).toBe("tok-fede");
    expect((await listTrips())[0]).toMatchObject({ memberName: "Fede", role: "member" });
  });

  it("if the server rejects, it propagates its message and saves nothing", async () => {
    mockFetch(409, { error: "Ya hay alguien con ese nombre en el viaje" });

    await expect(joinTrip({ code: "HUB5FT", name: "Fede" })).rejects.toThrow(
      "Ya hay alguien con ese nombre en el viaje",
    );
    expect(await listTrips()).toEqual([]);
  });
});

describe("fetchTrip", () => {
  it("uses the trip's saved token", async () => {
    mockFetch(201, { trip, member: { id: "m2", name: "Fede", role: "member" }, token: "tok-fede" });
    await joinTrip({ code: "HUB5FT", name: "Fede" });

    const fetchMock = mockFetch(200, {
      trip,
      me: { id: "m2", name: "Fede", role: "member" },
      members: [],
      today: { date: "2027-01-05", photosLeft: 10, videosLeft: 3 },
      totalUploaded: 0,
    });
    const detail = await fetchTrip(trip.id);

    expect(detail.today.photosLeft).toBe(10);
    expect((fetchMock.mock.calls[0]![0] as Request).headers.get("authorization")).toBe("Bearer tok-fede");
  });

  it("fails if you have no session on that trip", async () => {
    await expect(fetchTrip("desconocido")).rejects.toThrow("No estás en este viaje");
  });
});

describe("renameMe", () => {
  const save = () =>
    saveSession({
      tripId: trip.id,
      tripName: trip.name,
      joinCode: trip.joinCode,
      memberId: "m1",
      memberName: "Juani",
      role: "admin",
      token: "tok",
    });

  it("sends the name with the trip token and saves it on the phone", async () => {
    await save();
    const fetchMock = mockFetch(200, { id: "m1", name: "Juan", role: "admin" });

    await renameMe(trip.id, "  Juan ");

    const req = fetchMock.mock.calls[0]![0] as Request;
    expect(req.method).toBe("PATCH");
    expect(new URL(req.url).pathname).toBe(`/trips/${trip.id}/members/me`);
    expect(req.headers.get("authorization")).toBe("Bearer tok");
    expect(await sentBody(fetchMock)).toEqual({ name: "Juan" });
    expect((await listTrips())[0]!.memberName).toBe("Juan");
    expect(await getToken(trip.id)).toBe("tok");
  });

  it("if the server rejects the name it throws the error and changes nothing", async () => {
    await save();
    mockFetch(409, { error: "Ya hay alguien con ese nombre en el viaje" });

    await expect(renameMe(trip.id, "Fede")).rejects.toThrow("Ya hay alguien con ese nombre en el viaje");
    expect((await listTrips())[0]!.memberName).toBe("Juani");
  });
});

describe("fetchFeed", () => {
  it("requests the trip feed with the token and returns it", async () => {
    mockFetch(201, { trip, member: { id: "m2", name: "Fede", role: "member" }, token: "tok-fede" });
    await joinTrip({ code: "HUB5FT", name: "Fede" });

    const feed = { revealed: false, revealAt: NOW, items: [] };
    const fetchMock = mockFetch(200, feed);
    const result = await fetchFeed(trip.id);

    expect(result).toEqual(feed);
    const req = fetchMock.mock.calls[0]![0] as Request;
    expect(new URL(req.url).pathname).toBe(`/trips/${trip.id}/feed`);
    expect(req.headers.get("authorization")).toBe("Bearer tok-fede");
  });

  it("fails if you have no session on that trip", async () => {
    await expect(fetchFeed("desconocido")).rejects.toThrow("No estás en este viaje");
  });
});

describe("deleteMedia", () => {
  it("deletes the photo with the trip token", async () => {
    mockFetch(201, { trip, member: { id: "m1", name: "Juani", role: "admin" }, token: "tok-admin" });
    await joinTrip({ code: "HUB5FT", name: "Juani" });
    const fetchMock = jest.fn(async (_req: Request) => new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await deleteMedia(trip.id, "foto-1");

    const req = fetchMock.mock.calls[0]![0] as Request;
    expect(req.method).toBe("DELETE");
    expect(new URL(req.url).pathname).toBe("/media/foto-1");
    expect(req.headers.get("authorization")).toBe("Bearer tok-admin");
  });

  it("if the server rejects, it throws its message", async () => {
    mockFetch(201, { trip, member: { id: "m2", name: "Fede", role: "member" }, token: "tok" });
    await joinTrip({ code: "HUB5FT", name: "Fede" });
    mockFetch(403, { error: "Solo el admin puede borrar" });

    await expect(deleteMedia(trip.id, "foto-1")).rejects.toThrow("Solo el admin puede borrar");
  });

  it("fails if you have no session on that trip", async () => {
    await expect(deleteMedia("desconocido", "foto-1")).rejects.toThrow("No estás en este viaje");
  });
});

describe("joinWithToken", () => {
  const detail = {
    trip,
    me: { id: "m9", name: "Vos (prueba)", role: "member" },
    members: [{ id: "m9", name: "Vos (prueba)", role: "member" }],
    today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
    totalUploaded: 0,
  };

  it("fetches the trip with that token and saves the session", async () => {
    const fetchMock = mockFetch(200, detail);

    const joined = await joinWithToken(trip.id, "tok-dev");

    const req = fetchMock.mock.calls.at(-1)![0] as Request;
    expect(req.url).toContain(`/trips/${trip.id}`);
    expect(req.headers.get("authorization")).toBe("Bearer tok-dev");
    expect(joined.id).toBe(trip.id);
    expect(await getToken(trip.id)).toBe("tok-dev");
    expect(await listTrips()).toEqual([
      expect.objectContaining({
        tripId: trip.id,
        tripName: trip.name,
        joinCode: trip.joinCode,
        memberId: "m9",
        memberName: "Vos (prueba)",
        role: "member",
      }),
    ]);
  });

  it("throws the server error and saves nothing when the token is invalid", async () => {
    mockFetch(401, { error: "Falta el token o es inválido" });

    await expect(joinWithToken(trip.id, "mal")).rejects.toThrow("Falta el token o es inválido");
    expect(await getToken(trip.id)).toBeNull();
  });
});
