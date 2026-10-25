import { setSessionToken } from "@/storage/session";
import { fetchNotificationSettings, updateNotificationSettings } from "../actions";

const ALL_ON = { addedToTrip: true, newFriend: true, tripStarted: true, tripRevealed: true, photoFeatured: true, photoLiked: true, friendRequest: true };

function mockFetch(body: unknown, status = 200) {
  const fetchMock = jest.fn(async (_req: Request) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

beforeEach(() => setSessionToken("tok"));

describe("notification settings", () => {
  it("reads them with GET /me/settings", async () => {
    const fetchMock = mockFetch({ notifications: ALL_ON });

    expect(await fetchNotificationSettings()).toEqual(ALL_ON);
    const [request] = fetchMock.mock.calls[0]!;
    expect(request.method).toBe("GET");
    expect(request.url).toMatch(/\/me\/settings$/);
  });

  it("saves only the keys given with PATCH /me/settings and returns them all", async () => {
    const fetchMock = mockFetch({ notifications: { ...ALL_ON, photoLiked: false } });

    expect(await updateNotificationSettings({ photoLiked: false })).toEqual({ ...ALL_ON, photoLiked: false });
    const [request] = fetchMock.mock.calls[0]!;
    expect(request.method).toBe("PATCH");
    expect(await request.json()).toEqual({ notifications: { photoLiked: false } });
  });

  it("a server error comes back with its message", async () => {
    mockFetch({ error: "Datos inválidos" }, 400);

    await expect(updateNotificationSettings({ newFriend: false })).rejects.toThrow("Datos inválidos");
  });
});
