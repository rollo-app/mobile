import { setSessionToken } from "@/storage/session";
import { addComment, deleteComment, fetchComments } from "../actions";

function mockApi(status: number, body?: unknown) {
  const fetchMock = jest.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
const request = (fetchMock: jest.Mock) => fetchMock.mock.calls[0]![0] as Request;

const comment = {
  id: "c1",
  text: "jajaja",
  createdAt: 1,
  author: { userId: "u2", name: "Fede", username: null, avatarUrl: null },
  canDelete: false,
};

beforeEach(() => setSessionToken("tok"));

describe("comments actions", () => {
  it("lists the comments of a photo", async () => {
    const fetchMock = mockApi(200, { comments: [comment] });
    expect(await fetchComments("m1")).toEqual([comment]);
    expect(request(fetchMock).method).toBe("GET");
    expect(new URL(request(fetchMock).url).pathname).toBe("/media/m1/comments");
  });

  it("posts a comment and returns it", async () => {
    const fetchMock = mockApi(201, comment);
    expect(await addComment("m1", "jajaja")).toEqual(comment);
    expect(request(fetchMock).method).toBe("POST");
    expect(new URL(request(fetchMock).url).pathname).toBe("/media/m1/comments");
    expect(await request(fetchMock).json()).toEqual({ text: "jajaja" });
  });

  it("deletes a comment", async () => {
    const fetchMock = mockApi(204);
    await deleteComment("c1");
    expect(request(fetchMock).method).toBe("DELETE");
    expect(new URL(request(fetchMock).url).pathname).toBe("/comments/c1");
  });

  it("throws the server's message", async () => {
    mockApi(400, { error: "El comentario puede tener hasta 500 caracteres" });
    await expect(addComment("m1", "x")).rejects.toThrow("El comentario puede tener hasta 500 caracteres");
  });
});
