import { ApiError, createApiClient, unwrap } from "../client";

const BASE = "https://api.test";

function mockFetch(status: number, body: unknown) {
  const fetchMock = jest.fn(async (_req: Request) =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const lastRequest = (fetchMock: jest.Mock) => fetchMock.mock.calls.at(-1)![0] as Request;

describe("createApiClient", () => {
  it("manda el token como Bearer cuando hay uno", async () => {
    const fetchMock = mockFetch(200, { revealed: false, revealAt: 1, items: [] });
    const api = createApiClient({ baseUrl: BASE, token: "abc123" });

    await api.GET("/trips/{tripId}/feed", { params: { path: { tripId: "t1" } } });

    const req = lastRequest(fetchMock);
    expect(req.url).toBe(`${BASE}/trips/t1/feed`);
    expect(req.headers.get("authorization")).toBe("Bearer abc123");
  });

  it("no manda Authorization si no hay token", async () => {
    const fetchMock = mockFetch(404, { error: "Código inválido" });
    const api = createApiClient({ baseUrl: BASE });

    await api.POST("/trips/join", { body: { code: "ABC234", name: "Fede" } });

    expect(lastRequest(fetchMock).headers.get("authorization")).toBeNull();
  });
});

describe("unwrap", () => {
  it("devuelve los datos si la respuesta es exitosa", async () => {
    mockFetch(200, { revealed: true, revealAt: 1, items: [] });
    const api = createApiClient({ baseUrl: BASE, token: "t" });

    const feed = await unwrap(api.GET("/trips/{tripId}/feed", { params: { path: { tripId: "t1" } } }));

    expect(feed.revealed).toBe(true);
  });

  it("convierte el { error } del server en un ApiError con su mensaje y status", async () => {
    mockFetch(404, { error: "Código inválido" });
    const api = createApiClient({ baseUrl: BASE });

    const promise = unwrap(api.POST("/trips/join", { body: { code: "ZZZZZZ", name: "Fede" } }));

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ status: 404, message: "Código inválido" });
  });

  it("si no hay conexión, tira un ApiError claro", async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: BASE });

    await expect(unwrap(api.POST("/trips/join", { body: { code: "ABC234", name: "Fede" } }))).rejects.toMatchObject({
      status: 0,
      message: "Sin conexión. Probá de nuevo cuando tengas señal.",
    });
  });

  it("acepta respuestas sin cuerpo (204)", async () => {
    mockFetch(204, undefined);
    const api = createApiClient({ baseUrl: BASE, token: "t" });

    await expect(
      unwrap(api.DELETE("/media/{mediaId}", { params: { path: { mediaId: "m1" } } })),
    ).resolves.toBeUndefined();
  });
});
