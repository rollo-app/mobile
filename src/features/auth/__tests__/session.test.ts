import * as Notifications from "expo-notifications";
import { queryClient } from "@/api/query-client";
import { createApiClient } from "@/api/client";
import { getActiveTripId, setActiveTripId } from "@/storage/active-trip";
import { getSessionToken, setSessionToken } from "@/storage/session";
import { getSessionUserIdStored } from "@/storage/session-user";
import { syncPushToken } from "@/features/notifications/push-token";
import { claimLegacyQueue } from "@/features/capture/account-queue";
import { authedClient, getSession, getSessionUserId, signIn, signOut, subscribeSession } from "../session";

jest.mock("@/features/capture/account-queue", () => ({ claimLegacyQueue: jest.fn(async () => {}), discardAccountQueue: jest.fn(async () => {}) }));

describe("session", () => {
  it("signIn saves the token and notifies subscribers", async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSession(listener);

    await signIn("tok", "u1");

    expect(await getSessionToken()).toBe("tok");
    expect(listener).toHaveBeenCalledWith("tok");
    unsubscribe();
  });

  it("signOut clears the token, the active trip and the query cache, and notifies", async () => {
    await signIn("tok", "u1");
    await setActiveTripId("t1");
    queryClient.setQueryData(["me"], { id: "u1" });
    const listener = jest.fn();
    subscribeSession(listener);

    await signOut();

    expect(await getSessionToken()).toBeNull();
    expect(await getActiveTripId()).toBeNull();
    expect(queryClient.getQueryData(["me"])).toBeUndefined();
    expect(listener).toHaveBeenCalledWith(null);
  });

  it("getSession reads the saved token", async () => {
    expect(await getSession()).toBeNull();
    await signIn("tok", "u1");
    expect(await getSession()).toBe("tok");
  });

  it("authedClient fails with a 401 ApiError when there is no session", async () => {
    await expect(authedClient()).rejects.toMatchObject({ status: 401 });
  });

  it("a 401 on any request closes the local session once", async () => {
    await signIn("tok", "u1");
    globalThis.fetch = jest.fn(async () => new Response(JSON.stringify({ error: "Sesión inválida, volvé a entrar" }), { status: 401 })) as unknown as typeof fetch;

    await createApiClient({ baseUrl: "https://api.test", token: "tok" }).GET("/me");

    await new Promise((r) => setTimeout(r, 0));
    expect(await getSessionToken()).toBeNull();
  });

  it("a 401 of an old token doesn't close a newer session", async () => {
    await signIn("new", "u1");
    globalThis.fetch = jest.fn(async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;

    await createApiClient({ baseUrl: "https://api.test", token: "old" }).GET("/me");

    await new Promise((r) => setTimeout(r, 0));
    expect(await getSessionToken()).toBe("new");
  });

  it("a 401 also tells the server to stop pushes to this phone, once and without blocking the sign-out", async () => {
    await signIn("tok", "u1");
    const notifications = jest.mocked(Notifications);
    notifications.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: "granted" } as never);
    globalThis.fetch = jest.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
    await syncPushToken();
    const fetchMock = jest.fn(async (_req: Request) => new Response("{}", { status: 401 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await createApiClient({ baseUrl: "https://api.test", token: "tok" }).GET("/me");

    await waitForCondition(async () => (await getSessionToken()) === null);
    await waitForCondition(async () => fetchMock.mock.calls.length >= 2);
    await new Promise((r) => setTimeout(r, 20));
    const deletes = fetchMock.mock.calls.map(([r]) => r).filter((r) => r.method === "DELETE");
    expect(deletes).toHaveLength(1);
    expect(deletes[0]!.url).toMatch(/\/me\/push-tokens\//);
    expect(deletes[0]!.headers.get("authorization")).toBe("Bearer tok");
    notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true, status: "undetermined" } as never);
  });
});

async function waitForCondition(check: () => Promise<boolean>) {
  for (let i = 0; i < 50; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 1));
  }
  throw new Error("condition never met");
}

describe("session user id", () => {
  it("signIn saves the account's user id and signOut forgets it", async () => {
    await signIn("tok", "u7");
    expect(await getSessionUserIdStored()).toBe("u7");

    await signOut();

    expect(await getSessionUserIdStored()).toBeNull();
  });
});

describe("getSessionUserId", () => {
  beforeEach(() => jest.mocked(claimLegacyQueue).mockClear());

  const mockMe = (status: number, body: unknown = {}) => {
    const fetchMock = jest.fn(async () => new Response(JSON.stringify(body), { status }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  };

  it("returns the stored id without asking the server", async () => {
    await signIn("tok", "u1");
    const fetchMock = mockMe(200);

    expect(await getSessionUserId()).toBe("u1");
    expect(fetchMock).not.toHaveBeenCalled();
    // A session that always knew its id never left photos without an owner: nothing to claim.
    expect(claimLegacyQueue).not.toHaveBeenCalled();
  });

  it("for a session opened before the id was stored, asks GET /me once and keeps the answer", async () => {
    await setSessionToken("tok");
    const fetchMock = mockMe(200, { id: "u9", email: "a@b.c", name: "A", avatarUrl: null });

    expect(await getSessionUserId()).toBe("u9");
    expect(await getSessionUserIdStored()).toBe("u9");
    expect(await getSessionUserId()).toBe("u9");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives the photos without an owner to that same old session once it learns its id, and to no one else", async () => {
    await setSessionToken("tok");
    mockMe(200, { id: "u9", email: "a@b.c", name: "A", avatarUrl: null });

    await getSessionUserId();

    expect(claimLegacyQueue).toHaveBeenCalledTimes(1);
    expect(claimLegacyQueue).toHaveBeenCalledWith("u9");
  });

  it("is null when there is no session", async () => {
    const fetchMock = mockMe(200);
    expect(await getSessionUserId()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is null without network and stores nothing", async () => {
    await setSessionToken("tok");
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;

    expect(await getSessionUserId()).toBeNull();
    expect(await getSessionUserIdStored()).toBeNull();
  });
});
