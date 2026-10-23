import { createHash } from "crypto";
import { getLoginLinkVerifier, setLoginLinkVerifier } from "@/storage/login-link-verifier";
import { getSessionToken, setSessionToken } from "@/storage/session";
import { deleteAccount, fetchMe, LINK_FROM_OTHER_REQUEST, logout, startEmailLogin, verifyCode, verifyMagicLink } from "../actions";

const user = { id: "u1", email: "juani@rollo.test", name: "Juani", avatarUrl: null };

function mockFetch(status: number, body?: unknown) {
  const fetchMock = jest.fn(async (_req: Request) => new Response(body === undefined ? null : JSON.stringify(body), { status }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
const req = (m: jest.Mock) => m.mock.calls.at(-1)![0] as Request;

describe("startEmailLogin", () => {
  it("asks for a code for the trimmed, lowercased email", async () => {
    const fetchMock = mockFetch(204);

    await startEmailLogin("  Juani@Rollo.test ");

    expect(req(fetchMock).url).toMatch(/\/auth\/email\/start$/);
    expect(await req(fetchMock).json()).toEqual({ email: "juani@rollo.test", linkChallenge: expect.any(String) });
  });

  it("binds the email's link to this phone: sends the challenge and keeps its verifier", async () => {
    const fetchMock = mockFetch(204);

    await startEmailLogin(" Juani@Rollo.test ");

    const stored = await getLoginLinkVerifier();
    expect(stored).toEqual({ email: "juani@rollo.test", verifier: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) });
    const { linkChallenge } = await req(fetchMock).json();
    expect(linkChallenge).toBe(createHash("sha256").update(stored!.verifier).digest("base64url"));
  });

  it("a resend overwrites the verifier", async () => {
    mockFetch(204);
    await startEmailLogin("juani@rollo.test");
    const first = await getLoginLinkVerifier();
    await startEmailLogin("juani@rollo.test");

    expect((await getLoginLinkVerifier())!.verifier).not.toBe(first!.verifier);
  });

  it("propagates the server's message", async () => {
    mockFetch(429, { error: "Pediste demasiados códigos" });
    await expect(startEmailLogin("a@b.c")).rejects.toThrow("Pediste demasiados códigos");
  });
});

describe("verifyCode", () => {
  it("saves the session and returns the user", async () => {
    const fetchMock = mockFetch(200, { token: "tok", user, isNew: false });

    const result = await verifyCode("Juani@rollo.test", " 123456 ");

    expect(await req(fetchMock).json()).toEqual({ email: "juani@rollo.test", code: "123456" });
    expect(await getSessionToken()).toBe("tok");
    expect(result).toEqual({ user, isNew: false });
  });

  it("with a wrong code it saves nothing", async () => {
    mockFetch(400, { error: "Código incorrecto" });
    await expect(verifyCode("a@b.c", "000000")).rejects.toThrow("Código incorrecto");
    expect(await getSessionToken()).toBeNull();
  });
});

describe("fetchMe", () => {
  it("sends the session token", async () => {
    await setSessionToken("tok");
    const fetchMock = mockFetch(200, user);

    expect(await fetchMe()).toEqual(user);
    expect(req(fetchMock).headers.get("authorization")).toBe("Bearer tok");
  });
});

describe("logout", () => {
  it("tells the server and clears the local session", async () => {
    await setSessionToken("tok");
    const fetchMock = mockFetch(204);

    await logout();

    expect(req(fetchMock).url).toMatch(/\/auth\/logout$/);
    expect(await getSessionToken()).toBeNull();
  });

  it("first unregisters this phone's push token, while the session is still valid", async () => {
    const Notifications = jest.mocked(require("expo-notifications") as typeof import("expo-notifications"));
    Notifications.getPermissionsAsync.mockResolvedValueOnce({ granted: true, canAskAgain: true, status: "granted" } as never);
    await setSessionToken("tok");
    const fetchMock = mockFetch(204);

    await logout();

    const calls = fetchMock.mock.calls.map(([r]) => r as Request);
    expect(calls.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual([
      "DELETE /me/push-tokens/ExponentPushToken%5Btest-token%5D",
      "POST /auth/logout",
    ]);
    expect(calls[0]!.headers.get("authorization")).toBe("Bearer tok");
    expect(await getSessionToken()).toBeNull();
  });

  it("clears the local session even without connection", async () => {
    await setSessionToken("tok");
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;

    await logout();

    expect(await getSessionToken()).toBeNull();
  });
});

describe("deleteAccount", () => {
  it("deletes on the server and then clears the session", async () => {
    await setSessionToken("tok");
    const fetchMock = mockFetch(204);

    await deleteAccount();

    expect(req(fetchMock).method).toBe("DELETE");
    expect(await getSessionToken()).toBeNull();
  });

  it("if the server fails, the session stays", async () => {
    await setSessionToken("tok");
    mockFetch(500, { error: "Error del servidor" });

    await expect(deleteAccount()).rejects.toThrow("Error del servidor");
    expect(await getSessionToken()).toBe("tok");
  });
});

describe("verifyCode seeds /me", () => {
  it("puts the user in the cache so the gate doesn't need another request", async () => {
    const { queryClient } = require("@/api/query-client");
    mockFetch(200, { token: "tok", user, isNew: true });

    await verifyCode("juani@rollo.test", "123456");

    expect(queryClient.getQueryData(["me"])).toEqual(user);
  });
});

describe("verifyMagicLink", () => {
  const VERIFIER = "v".repeat(43);

  it("posts the email, the link's token and this phone's verifier, saves the session, seeds /me and forgets the verifier", async () => {
    const { queryClient } = require("@/api/query-client");
    await setLoginLinkVerifier({ email: "juani@rollo.test", verifier: VERIFIER });
    const fetchMock = mockFetch(200, { token: "tok", user, isNew: true });

    const result = await verifyMagicLink(" Juani@Rollo.test ", "link-token");

    expect(req(fetchMock).url).toMatch(/\/auth\/email\/verify-link$/);
    expect(req(fetchMock).method).toBe("POST");
    expect(await req(fetchMock).json()).toEqual({ email: "juani@rollo.test", token: "link-token", verifier: VERIFIER });
    expect(await getSessionToken()).toBe("tok");
    expect(queryClient.getQueryData(["me"])).toEqual(user);
    expect(result).toEqual({ user, isNew: true });
    expect(await getLoginLinkVerifier()).toBeNull();
  });

  it("with a dead link it saves nothing and propagates the server's message", async () => {
    await setLoginLinkVerifier({ email: "a@b.c", verifier: VERIFIER });
    mockFetch(400, { error: "El link venció o ya se usó. Pedí otro código." });
    await expect(verifyMagicLink("a@b.c", "x")).rejects.toThrow("El link venció o ya se usó. Pedí otro código.");
    expect(await getSessionToken()).toBeNull();
  });

  it("without a verifier from this phone it never asks the server", async () => {
    const fetchMock = mockFetch(200, { token: "tok", user, isNew: false });
    await expect(verifyMagicLink("a@b.c", "x")).rejects.toThrow(LINK_FROM_OTHER_REQUEST);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getSessionToken()).toBeNull();
  });

  it("with a verifier for another email it never asks the server and keeps the verifier", async () => {
    await setLoginLinkVerifier({ email: "juani@rollo.test", verifier: VERIFIER });
    const fetchMock = mockFetch(200, { token: "tok", user, isNew: false });

    await expect(verifyMagicLink("atacante@rollo.test", "x")).rejects.toThrow(LINK_FROM_OTHER_REQUEST);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getLoginLinkVerifier()).toEqual({ email: "juani@rollo.test", verifier: VERIFIER });
  });
});
