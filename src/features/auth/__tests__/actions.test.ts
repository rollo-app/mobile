import { getSessionToken, setSessionToken } from "@/storage/session";
import { deleteAccount, fetchMe, logout, startEmailLogin, verifyCode, verifyMagicLink } from "../actions";

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
    expect(await req(fetchMock).json()).toEqual({ email: "juani@rollo.test" });
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
  it("posts the email and the link's token, saves the session and seeds /me", async () => {
    const { queryClient } = require("@/api/query-client");
    const fetchMock = mockFetch(200, { token: "tok", user, isNew: true });

    const result = await verifyMagicLink(" Juani@Rollo.test ", "link-token");

    expect(req(fetchMock).url).toMatch(/\/auth\/email\/verify-link$/);
    expect(req(fetchMock).method).toBe("POST");
    expect(await req(fetchMock).json()).toEqual({ email: "juani@rollo.test", token: "link-token" });
    expect(await getSessionToken()).toBe("tok");
    expect(queryClient.getQueryData(["me"])).toEqual(user);
    expect(result).toEqual({ user, isNew: true });
  });

  it("with a dead link it saves nothing and propagates the server's message", async () => {
    mockFetch(400, { error: "El link venció o ya se usó. Pedí otro código." });
    await expect(verifyMagicLink("a@b.c", "x")).rejects.toThrow("El link venció o ya se usó. Pedí otro código.");
    expect(await getSessionToken()).toBeNull();
  });
});
