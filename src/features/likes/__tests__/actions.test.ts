import { setSessionToken } from "@/storage/session";
import { likeMedia, unlikeMedia } from "../actions";

function mockApi(status: number, body?: unknown) {
  const fetchMock = jest.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
const request = (fetchMock: jest.Mock) => fetchMock.mock.calls[0]![0] as Request;

beforeEach(() => setSessionToken("tok"));

describe("likes actions", () => {
  it("likes a photo with a PUT", async () => {
    const fetchMock = mockApi(204);
    await likeMedia("m1");
    expect(request(fetchMock).method).toBe("PUT");
    expect(new URL(request(fetchMock).url).pathname).toBe("/media/m1/like");
  });

  it("removes a like with a DELETE", async () => {
    const fetchMock = mockApi(204);
    await unlikeMedia("m1");
    expect(request(fetchMock).method).toBe("DELETE");
    expect(new URL(request(fetchMock).url).pathname).toBe("/media/m1/like");
  });

  it("throws the server's message", async () => {
    mockApi(404, { error: "No encontramos esa foto" });
    await expect(likeMedia("m1")).rejects.toThrow("No encontramos esa foto");
  });
});
