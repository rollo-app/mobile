import { setSessionToken } from "@/storage/session";
import { blockUser, fetchBlocked, reportMedia, reportUser, unblockUser } from "../actions";

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

describe("reportMedia", () => {
  it("POSTs /reports with the media id and reason", async () => {
    const fetchMock = mockApi([[/^POST \/reports$/, 204]]);

    await reportMedia("m1", "offensive");

    expect(request(fetchMock).headers.get("Authorization")).toBe("Bearer tok");
    expect(await request(fetchMock).json()).toEqual({ mediaId: "m1", reason: "offensive" });
  });

  it("propagates the server error", async () => {
    mockApi([[/./, 404, { error: "No existe" }]]);
    await expect(reportMedia("m1", "other")).rejects.toThrow("No existe");
  });
});

describe("reportUser", () => {
  it("POSTs /reports with the user id and reason", async () => {
    const fetchMock = mockApi([[/^POST \/reports$/, 204]]);

    await reportUser("u2", "abuse");

    expect(await request(fetchMock).json()).toEqual({ userId: "u2", reason: "abuse" });
  });
});

describe("blockUser / unblockUser", () => {
  it("PUTs /blocks/{id}", async () => {
    const fetchMock = mockApi([[/^PUT \/blocks\/u2$/, 204]]);
    await blockUser("u2");
    expect(request(fetchMock).method).toBe("PUT");
  });

  it("DELETEs /blocks/{id}", async () => {
    const fetchMock = mockApi([[/^DELETE \/blocks\/u2$/, 204]]);
    await unblockUser("u2");
    expect(request(fetchMock).method).toBe("DELETE");
  });
});

describe("fetchBlocked", () => {
  it("returns the blocked list", async () => {
    const cami = { id: "u2", name: "Cami", username: "cami", avatarUrl: null };
    mockApi([[/^GET \/blocks$/, 200, { blocked: [cami] }]]);
    expect(await fetchBlocked()).toEqual([cami]);
  });
});
