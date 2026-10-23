import * as Notifications from "expo-notifications";
import { queryClient } from "@/api/query-client";
import { createApiClient } from "@/api/client";
import { getActiveTripId, setActiveTripId } from "@/storage/active-trip";
import { getSessionToken } from "@/storage/session";
import { syncPushToken } from "@/features/notifications/push-token";
import { authedClient, getSession, signIn, signOut, subscribeSession } from "../session";

describe("session", () => {
  it("signIn saves the token and notifies subscribers", async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSession(listener);

    await signIn("tok");

    expect(await getSessionToken()).toBe("tok");
    expect(listener).toHaveBeenCalledWith("tok");
    unsubscribe();
  });

  it("signOut clears the token, the active trip and the query cache, and notifies", async () => {
    await signIn("tok");
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
    await signIn("tok");
    expect(await getSession()).toBe("tok");
  });

  it("authedClient fails with a 401 ApiError when there is no session", async () => {
    await expect(authedClient()).rejects.toMatchObject({ status: 401 });
  });

  it("a 401 on any request closes the local session once", async () => {
    await signIn("tok");
    globalThis.fetch = jest.fn(async () => new Response(JSON.stringify({ error: "Sesión inválida, volvé a entrar" }), { status: 401 })) as unknown as typeof fetch;

    await createApiClient({ baseUrl: "https://api.test", token: "tok" }).GET("/me");

    await new Promise((r) => setTimeout(r, 0));
    expect(await getSessionToken()).toBeNull();
  });

  it("a 401 of an old token doesn't close a newer session", async () => {
    await signIn("new");
    globalThis.fetch = jest.fn(async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;

    await createApiClient({ baseUrl: "https://api.test", token: "old" }).GET("/me");

    await new Promise((r) => setTimeout(r, 0));
    expect(await getSessionToken()).toBe("new");
  });

  it("a 401 also tells the server to stop pushes to this phone, once and without blocking the sign-out", async () => {
    await signIn("tok");
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
