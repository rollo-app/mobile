import { Skia } from "@shopify/react-native-skia";
import { API_URL } from "@/config";
import { loadImages } from "../load-images";

jest.mock("@shopify/react-native-skia", () => ({
  Skia: {
    Data: { fromBytes: jest.fn((bytes: Uint8Array) => ({ bytes })) },
    Image: { MakeImageFromEncoded: jest.fn() },
  },
}));
jest.mock("@/features/auth/session", () => ({
  ...jest.requireActual("@/features/auth/session"),
  getSession: jest.fn(async () => "tok"),
}));

type Reply = { ok: boolean; status: number; arrayBuffer: () => Promise<ArrayBuffer> };

/** A response whose body is one byte, so each decoded "image" says which request it came from. */
const reply = (byte: number, status = 200): Reply => ({
  ok: status >= 200 && status < 300,
  status,
  arrayBuffer: async () => Uint8Array.of(byte).buffer,
});

const fetchMock = jest.fn<Promise<Reply>, [string, RequestInit?]>();

/** Byte the fake decoder rejects, like a corrupt JPEG. */
const UNDECODABLE = 255;

beforeEach(() => {
  fetchMock.mockReset();
  // The mocked "image" is the body's byte; `UNDECODABLE` decodes to null.
  jest.mocked(Skia.Image.MakeImageFromEncoded).mockImplementation((data) => {
    const byte = (data as unknown as { bytes: Uint8Array }).bytes[0];
    return (byte === UNDECODABLE ? null : { image: byte }) as never;
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe("loadImages", () => {
  it("downloads each path from the API with the session's Bearer token", async () => {
    fetchMock.mockResolvedValue(reply(7));
    const images = await loadImages(["/media/a/thumb", "/media/b/thumb"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_URL}/media/a/thumb`);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${API_URL}/media/b/thumb`);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.headers).toEqual({ Authorization: "Bearer tok" });
    }
    expect(images).toEqual([{ image: 7 }, { image: 7 }]);
  });

  it("gives null in the position of a 404, a network error or an undecodable image, without throwing", async () => {
    fetchMock.mockImplementation(async (url) => {
      if (url.endsWith("/missing")) return reply(0, 404);
      if (url.endsWith("/offline")) throw new TypeError("Network request failed");
      if (url.endsWith("/garbage")) return reply(UNDECODABLE);
      return reply(Number(url.slice(-1)));
    });
    const images = await loadImages(["/p1", "/missing", "/p3", "/offline", "/garbage"]);
    expect(images).toEqual([{ image: 1 }, null, { image: 3 }, null, null]);
  });

  it("never runs more than 4 downloads at once, and keeps the order", async () => {
    let running = 0;
    let peak = 0;
    fetchMock.mockImplementation(async (url) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return reply(Number(url.split("/").pop()));
    });
    const paths = Array.from({ length: 10 }, (_, i) => `/p/${i}`);
    const images = await loadImages(paths);
    expect(peak).toBe(4);
    expect(images).toEqual(paths.map((_, i) => ({ image: i })));
  });

  it("returns an empty list for no paths", async () => {
    await expect(loadImages([])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
