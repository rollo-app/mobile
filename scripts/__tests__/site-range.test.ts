/// <reference types="node" />
import { parseRange, withRange } from "../site/range.js";
import worker from "../../site/worker.js";

describe("parseRange", () => {
  it("parses start-end", () => expect(parseRange("bytes=0-1", 1000)).toEqual([0, 1]));
  it("parses open end", () => expect(parseRange("bytes=100-", 1000)).toEqual([100, 999]));
  it("parses suffix", () => expect(parseRange("bytes=-500", 1000)).toEqual([500, 999]));
  it("clamps suffix larger than size", () => expect(parseRange("bytes=-5000", 1000)).toEqual([0, 999]));
  it("clamps end beyond size", () => expect(parseRange("bytes=900-5000", 1000)).toEqual([900, 999]));
  it("flags start beyond size", () => expect(parseRange("bytes=1000-1001", 1000)).toBe("unsatisfiable"));
  it("ignores multi-range", () => expect(parseRange("bytes=0-1,5-6", 1000)).toBeNull());
  it("ignores garbage and missing", () => {
    expect(parseRange("nope", 1000)).toBeNull();
    expect(parseRange("bytes=-", 1000)).toBeNull();
    expect(parseRange(null, 1000)).toBeNull();
  });
});

const bytes = new Uint8Array(100).map((_, i) => i);
const asset = () =>
  new Response(bytes, {
    status: 200,
    headers: { "content-type": "video/mp4", "cache-control": "public, max-age=60", etag: '"abc"' },
  });
const env = { ASSETS: { fetch: jest.fn(async () => asset()) } };
const req = (path: string, init?: RequestInit) => new Request(`https://x.test${path}`, init);

describe("worker", () => {
  beforeEach(() => env.ASSETS.fetch.mockClear());

  it("serves 206 for a range", async () => {
    const res = await worker.fetch(req("/hero.mp4", { headers: { range: "bytes=0-1" } }), env);
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 0-1/100");
    expect(res.headers.get("content-length")).toBe("2");
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect(res.headers.get("etag")).toBe('"abc"');
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([0, 1]);
  });

  it("serves 200 with accept-ranges without Range", async () => {
    const res = await worker.fetch(req("/hero.mp4"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect((await res.arrayBuffer()).byteLength).toBe(100);
  });

  it("serves 416 when unsatisfiable", async () => {
    const res = await worker.fetch(req("/hero.mp4", { headers: { range: "bytes=500-" } }), env);
    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toBe("bytes */100");
  });

  it("falls back to full 200 on multi-range", async () => {
    const res = await worker.fetch(req("/hero.webm", { headers: { range: "bytes=0-1,5-6" } }), env);
    expect(res.status).toBe(200);
  });

  it("HEAD returns headers only", async () => {
    const res = await worker.fetch(req("/hero.mp4", { method: "HEAD", headers: { range: "bytes=0-9" } }), env);
    expect(res.status).toBe(206);
    expect(res.headers.get("content-length")).toBe("10");
    expect((await res.arrayBuffer()).byteLength).toBe(0);
  });

  it("passes other paths through untouched", async () => {
    const r = req("/soporte");
    await worker.fetch(r, env);
    expect(env.ASSETS.fetch).toHaveBeenCalledWith(r);
  });

  it("withRange is exported", () => expect(typeof withRange).toBe("function"));
});
