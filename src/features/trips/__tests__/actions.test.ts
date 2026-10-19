import { getToken, listTrips } from "@/storage/trips";
import { createTrip, fetchTrip, joinTrip } from "../actions";

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
  it("arranca hoy, dura los días indicados y se revela al terminar", async () => {
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

  it("guarda la sesión con el token de admin", async () => {
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
  it("normaliza código y nombre antes de mandarlos", async () => {
    const fetchMock = mockFetch(201, { trip, member: { id: "m2", name: "Fede", role: "member" }, token: "tok" });

    await joinTrip({ code: " hub5ft ", name: " Fede " });

    expect(await sentBody(fetchMock)).toEqual({ code: "HUB5FT", name: "Fede" });
  });

  it("guarda la sesión como miembro", async () => {
    mockFetch(201, { trip, member: { id: "m2", name: "Fede", role: "member" }, token: "tok-fede" });

    await joinTrip({ code: "HUB5FT", name: "Fede" });

    expect(await getToken(trip.id)).toBe("tok-fede");
    expect((await listTrips())[0]).toMatchObject({ memberName: "Fede", role: "member" });
  });

  it("si el server rechaza, propaga su mensaje y no guarda nada", async () => {
    mockFetch(409, { error: "Ya hay alguien con ese nombre en el viaje" });

    await expect(joinTrip({ code: "HUB5FT", name: "Fede" })).rejects.toThrow(
      "Ya hay alguien con ese nombre en el viaje",
    );
    expect(await listTrips()).toEqual([]);
  });
});

describe("fetchTrip", () => {
  it("usa el token guardado del viaje", async () => {
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

  it("falla si no tenés sesión en ese viaje", async () => {
    await expect(fetchTrip("desconocido")).rejects.toThrow("No estás en este viaje");
  });
});
