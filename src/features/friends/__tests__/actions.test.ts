import { setSessionToken } from "@/storage/session";
import {
  addFriendsToTrip,
  claimFriendLink,
  createFriendLink,
  fetchFriend,
  fetchFriends,
  leaveTrip,
  redeemFriend,
  removeFriend,
} from "../actions";

const cami = { id: "u2", name: "Cami", username: "cami", avatarUrl: null };

type Route = [RegExp, number, unknown?];
function mockApi(routes: Route[]) {
  const fetchMock = jest.fn(async (req: Request) => {
    const [, status, body] = routes.find(([re]) => re.test(`${req.method} ${new URL(req.url).pathname}`)) ?? [/./, 404, { error: "no route" }];
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
const request = (fetchMock: jest.Mock, i = 0) => fetchMock.mock.calls[i]![0] as Request;

beforeEach(() => setSessionToken("tok"));

describe("createFriendLink", () => {
  it("POSTs /friends/link with the session", async () => {
    const fetchMock = mockApi([[/^POST \/friends\/link$/, 200, { code: "K7M2QX9A", expiresAt: 5 }]]);

    expect(await createFriendLink()).toEqual({ code: "K7M2QX9A", expiresAt: 5 });
    expect(request(fetchMock).headers.get("Authorization")).toBe("Bearer tok");
  });
});

describe("claimFriendLink", () => {
  it("POSTs the code without a session", async () => {
    const claimed = { claimToken: "ct", expiresAt: 9, creator: { name: "Cami", username: "cami", avatarUrl: null } };
    const fetchMock = mockApi([[/^POST \/friend-links\/claim$/, 200, claimed]]);

    expect(await claimFriendLink("K7M2QX9A")).toEqual(claimed);
    expect(request(fetchMock).headers.get("Authorization")).toBeNull();
    expect(await request(fetchMock).json()).toEqual({ code: "K7M2QX9A" });
  });

  it("propagates the generic error", async () => {
    mockApi([[/./, 400, { error: "Código incorrecto o vencido" }]]);
    await expect(claimFriendLink("K7M2QX9A")).rejects.toThrow("Código incorrecto o vencido");
  });
});

describe("redeemFriend", () => {
  it("sends the code", async () => {
    const fetchMock = mockApi([[/^POST \/friends\/redeem$/, 200, { friend: cami }]]);

    expect(await redeemFriend({ code: "K7M2QX9A" })).toEqual(cami);
    expect(await request(fetchMock).json()).toEqual({ code: "K7M2QX9A" });
  });

  it("sends the claim token", async () => {
    const fetchMock = mockApi([[/^POST \/friends\/redeem$/, 200, { friend: cami }]]);

    await redeemFriend({ claimToken: "ct" });
    expect(await request(fetchMock).json()).toEqual({ claimToken: "ct" });
  });

  it("propagates the rate limit message", async () => {
    mockApi([[/./, 429, { error: "Demasiados intentos, probá más tarde" }]]);
    await expect(redeemFriend({ code: "K7M2QX9A" })).rejects.toThrow(/Demasiados intentos/);
  });
});

describe("fetchFriends", () => {
  it("returns the list", async () => {
    mockApi([[/^GET \/friends$/, 200, { friends: [cami] }]]);
    expect(await fetchFriends()).toEqual([cami]);
  });
});

describe("removeFriend", () => {
  it("DELETEs the friend", async () => {
    const fetchMock = mockApi([[/^DELETE \/friends\/u2$/, 204]]);

    await removeFriend("u2");
    expect(request(fetchMock).method).toBe("DELETE");
  });
});

describe("addFriendsToTrip", () => {
  it("POSTs the ids and returns a result per friend", async () => {
    const results = [{ userId: "u2", status: "added" }];
    const fetchMock = mockApi([[/^POST \/trips\/t1\/members$/, 200, { results }]]);

    expect(await addFriendsToTrip("t1", ["u2"])).toEqual(results);
    expect(await request(fetchMock).json()).toEqual({ friendIds: ["u2"] });
  });

  it("propagates the revealed message", async () => {
    mockApi([[/./, 409, { error: "Este rollo ya se reveló" }]]);
    await expect(addFriendsToTrip("t1", ["u2"])).rejects.toThrow("Este rollo ya se reveló");
  });
});

describe("leaveTrip", () => {
  it("DELETEs my membership", async () => {
    const fetchMock = mockApi([[/^DELETE \/trips\/t1\/members\/me$/, 204]]);

    await leaveTrip("t1");
    expect(new URL(request(fetchMock).url).pathname).toBe("/trips/t1/members/me");
  });

  it("propagates the admin message", async () => {
    mockApi([[/./, 409, { error: "Sos el admin: no podés salirte del rollo" }]]);
    await expect(leaveTrip("t1")).rejects.toThrow(/Sos el admin/);
  });
});

describe("fetchFriend", () => {
  it("GETs /friends/<id> and returns the friend and the trips in common", async () => {
    const profile = { friend: { ...cami, bio: "Hola" }, commonTrips: [{ id: "t1", name: "Sur", startsAt: 1, endsAt: 2, revealed: false }] };
    const fetchMock = mockApi([[/^GET \/friends\/u2$/, 200, profile]]);

    expect(await fetchFriend("u2")).toEqual(profile);
    expect(request(fetchMock).headers.get("Authorization")).toBe("Bearer tok");
  });

  it("propagates a 404 as an ApiError with its status", async () => {
    mockApi([[/./, 404, { error: "No es tu amigo" }]]);
    await expect(fetchFriend("u9")).rejects.toMatchObject({ status: 404, message: "No es tu amigo" });
  });
});
