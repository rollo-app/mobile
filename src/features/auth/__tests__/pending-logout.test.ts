import { getPendingLogouts } from "@/storage/pending-logout";
import { getSessionToken, setSessionToken } from "@/storage/session";
import { logout } from "../actions";
import { retryPendingLogouts } from "../pending-logout";
import { signIn } from "../session";

function respond(status: number) {
  const fetchMock = jest.fn(async (_req: Request) => new Response(status === 204 ? null : "{}", { status }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function offline() {
  const fetchMock = jest.fn(async (_req: Request) => {
    throw new TypeError("Network request failed");
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const logouts = (m: jest.Mock) => (m.mock.calls.map(([r]) => r) as Request[]).filter((r) => r.url.endsWith("/auth/logout"));

describe("logout without the server", () => {
  it("keeps the old session as a pending logout and still signs out", async () => {
    await setSessionToken("old");
    offline();

    await logout();

    expect(await getSessionToken()).toBeNull();
    expect(await getPendingLogouts()).toEqual(["old"]);
  });

  it("keeps it on a server error too", async () => {
    await setSessionToken("old");
    respond(500);

    await logout();

    expect(await getPendingLogouts()).toEqual(["old"]);
  });

  it("stores nothing when the server got it", async () => {
    await setSessionToken("old");
    respond(204);

    await logout();

    expect(await getPendingLogouts()).toEqual([]);
  });

  it("stores nothing when the session was already invalid", async () => {
    await setSessionToken("old");
    respond(401);

    await logout();

    expect(await getPendingLogouts()).toEqual([]);
  });

  it("keeps every session logged out offline, not just the last one", async () => {
    await setSessionToken("first");
    offline();
    await logout();
    await setSessionToken("second");
    await logout();

    expect(await getPendingLogouts()).toEqual(["first", "second"]);
  });
});

describe("retryPendingLogouts", () => {
  it("does nothing without pending logouts", async () => {
    const fetchMock = respond(204);

    await retryPendingLogouts();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs the old session out on the server and forgets it", async () => {
    await setSessionToken("old");
    offline();
    await logout();
    const fetchMock = respond(204);

    await retryPendingLogouts();

    const sent = logouts(fetchMock);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.method).toBe("POST");
    expect(sent[0]!.headers.get("authorization")).toBe("Bearer old");
    expect(await getPendingLogouts()).toEqual([]);
  });

  it("forgets it on a 401: the session is already invalid", async () => {
    await setSessionToken("old");
    offline();
    await logout();
    respond(401);

    await retryPendingLogouts();

    expect(await getPendingLogouts()).toEqual([]);
  });

  it("keeps it while the server can't be reached, without throwing", async () => {
    await setSessionToken("old");
    offline();
    await logout();

    await expect(retryPendingLogouts()).resolves.toBeUndefined();

    expect(await getPendingLogouts()).toEqual(["old"]);
  });

  it("doesn't touch a new session", async () => {
    await setSessionToken("old");
    offline();
    await logout();
    await signIn("new");
    const fetchMock = respond(401);

    await retryPendingLogouts();
    await new Promise((r) => setTimeout(r, 0));

    expect(logouts(fetchMock).map((r) => r.headers.get("authorization"))).toEqual(["Bearer old"]);
    expect(await getSessionToken()).toBe("new");
    expect(await getPendingLogouts()).toEqual([]);
  });

  it("runs once at a time", async () => {
    await setSessionToken("old");
    offline();
    await logout();
    const fetchMock = respond(204);

    await Promise.all([retryPendingLogouts(), retryPendingLogouts()]);

    expect(logouts(fetchMock)).toHaveLength(1);
  });
});
