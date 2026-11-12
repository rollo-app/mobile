import {
  ApiError,
  createApiClient,
  errorMessage,
  setUnauthorizedHandler,
  unwrap,
} from "../client";

const BASE = "https://api.test";

function mockFetch(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  const fetchMock = jest.fn(
    async (_req: Request) =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json", ...headers },
      }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const lastRequest = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls.at(-1)![0] as Request;

describe("createApiClient", () => {
  it("sends the token as Bearer when there is one", async () => {
    const fetchMock = mockFetch(200, {
      revealed: false,
      revealAt: 1,
      items: [],
    });
    const api = createApiClient({ baseUrl: BASE, token: "abc123" });

    await api.GET("/trips/{tripId}/feed", {
      params: { path: { tripId: "t1" } },
    });

    const req = lastRequest(fetchMock);
    expect(req.url).toBe(`${BASE}/trips/t1/feed`);
    expect(req.headers.get("authorization")).toBe("Bearer abc123");
  });

  it("does not send Authorization when there is no token", async () => {
    const fetchMock = mockFetch(404, { error: "Código inválido" });
    const api = createApiClient({ baseUrl: BASE });

    await api.POST("/trips/join", { body: { code: "ABC234" } });

    expect(lastRequest(fetchMock).headers.get("authorization")).toBeNull();
  });
});

describe("401 handling", () => {
  afterEach(() => setUnauthorizedHandler(null));

  it("tells the handler once, with the token that was rejected", async () => {
    mockFetch(401, { error: "Sesión inválida, volvé a entrar" });
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    const api = createApiClient({ baseUrl: BASE, token: "old" });

    await api.GET("/me");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("old");
  });

  it("ignores a 401 on a request that carried no token (e.g. a wrong login code)", async () => {
    mockFetch(401, { error: "Código incorrecto" });
    const handler = jest.fn();
    setUnauthorizedHandler(handler);

    await createApiClient({ baseUrl: BASE }).POST("/auth/email/verify", {
      body: { email: "a@b.c", code: "000000" },
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not call the handler for other errors", async () => {
    mockFetch(404, { error: "x" });
    const handler = jest.fn();
    setUnauthorizedHandler(handler);

    await createApiClient({ baseUrl: BASE, token: "t" }).GET("/me");

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("unwrap", () => {
  it("returns the data if the response is successful", async () => {
    mockFetch(200, { revealed: true, revealAt: 1, items: [] });
    const api = createApiClient({ baseUrl: BASE, token: "t" });

    const feed = await unwrap(
      api.GET("/trips/{tripId}/feed", { params: { path: { tripId: "t1" } } }),
    );

    expect(feed.revealed).toBe(true);
  });

  it("turns the server's { error } into an ApiError with its message and status", async () => {
    mockFetch(404, { error: "Código inválido" });
    const api = createApiClient({ baseUrl: BASE });

    const promise = unwrap(
      api.POST("/trips/join", { body: { code: "ZZZZZZ" } }),
    );

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      status: 404,
      message: "Código inválido",
    });
  });

  describe("Retry-After", () => {
    const failWith = async (headers: Record<string, string>) => {
      mockFetch(
        429,
        { error: "Estás yendo muy rápido. Probá de nuevo en un minuto." },
        headers,
      );
      const api = createApiClient({ baseUrl: BASE });
      return unwrap(api.POST("/trips/join", { body: { code: "ABC234" } })).then(
        () => {
          throw new Error("expected a rejection");
        },
        (e: ApiError) => e,
      );
    };

    it("exposes it in milliseconds when the server sends delta-seconds", async () => {
      expect((await failWith({ "retry-after": "60" })).retryAfterMs).toBe(
        60_000,
      );
    });

    it("is undefined when the header is absent", async () => {
      expect((await failWith({})).retryAfterMs).toBeUndefined();
    });

    it("is undefined when the header is garbage or an HTTP date", async () => {
      expect(
        (await failWith({ "retry-after": "pronto" })).retryAfterMs,
      ).toBeUndefined();
      expect(
        (await failWith({ "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" }))
          .retryAfterMs,
      ).toBeUndefined();
      expect(
        (await failWith({ "retry-after": "-5" })).retryAfterMs,
      ).toBeUndefined();
    });
  });

  it("with no connection, throws a clear ApiError", async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: BASE });

    await expect(
      unwrap(api.POST("/trips/join", { body: { code: "ABC234" } })),
    ).rejects.toMatchObject({
      status: 0,
      message: "Sin conexión. Probá de nuevo cuando tengas señal.",
    });
  });

  it("accepts responses without a body (204)", async () => {
    mockFetch(204, undefined);
    const api = createApiClient({ baseUrl: BASE, token: "t" });

    await expect(
      unwrap(
        api.DELETE("/media/{mediaId}", { params: { path: { mediaId: "m1" } } }),
      ),
    ).resolves.toBeUndefined();
  });
});

describe("errorMessage", () => {
  it("returns the error's own message", () => {
    expect(errorMessage(new ApiError(400, "Código inválido"), "fallback")).toBe(
      "Código inválido",
    );
  });

  it("falls back for anything that isn't an Error", () => {
    expect(errorMessage("boom", "No se pudo")).toBe("No se pudo");
  });

  it("is null when there's no error", () => {
    expect(errorMessage(null, "No se pudo")).toBeNull();
  });
});
