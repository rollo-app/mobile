import { act, renderHook } from "@testing-library/react-native";
import type { RevealedPhoto } from "@/features/media/revealed";
import { useThumbBytes } from "../use-thumb-bytes";

const photo = (id: string) => ({ id, thumbPath: `/m/${id}/thumb` }) as unknown as RevealedPhoto;
const buf = (n: number) => new ArrayBuffer(n);
type Deferred = { resolve: (res: object) => void; reject: () => void };

function mockFetch() {
  const pending: Deferred[] = [];
  globalThis.fetch = jest.fn(
    () => new Promise((resolve, reject) => pending.push({ resolve, reject: () => reject(new Error("x")) })),
  ) as unknown as typeof fetch;
  return pending;
}
const ok = (n: number) => ({ ok: true, arrayBuffer: async () => buf(n) });

describe("useThumbBytes", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("does nothing until enabled", async () => {
    const pending = mockFetch();
    const { result } = await renderHook(() => useThumbBytes([photo("a")], "t", false, 2500));
    expect(pending).toHaveLength(0);
    expect(result.current.settled).toBe(false);
  });

  it("settles once with every thumb when they all load (one update, not one per image)", async () => {
    const pending = mockFetch();
    let renders = 0;
    const { result } = await renderHook(() => {
      renders += 1;
      return useThumbBytes([photo("a"), photo("b")], "t", true, 2500);
    });
    const before = renders;
    await act(async () => pending[0]!.resolve(ok(1)));
    expect(result.current.settled).toBe(false);
    expect(renders).toBe(before);
    await act(async () => pending[1]!.resolve(ok(2)));
    expect(result.current.settled).toBe(true);
    expect(Object.keys(result.current.bytes).sort()).toEqual(["a", "b"]);
    expect(renders).toBe(before + 1);
  });

  it("counts a failed thumb as settled and leaves it out", async () => {
    const pending = mockFetch();
    const { result } = await renderHook(() => useThumbBytes([photo("a"), photo("b")], "t", true, 2500));
    await act(async () => pending[0]!.resolve({ ok: false, status: 500 }));
    await act(async () => pending[1]!.resolve(ok(2)));
    expect(result.current.settled).toBe(true);
    expect(Object.keys(result.current.bytes)).toEqual(["b"]);
  });

  it("settles after the cap with what it has and ignores late thumbs", async () => {
    const pending = mockFetch();
    const { result } = await renderHook(() => useThumbBytes([photo("a"), photo("b")], "t", true, 2500));
    await act(async () => pending[0]!.resolve(ok(1)));
    await act(async () => jest.advanceTimersByTime(2500));
    expect(result.current.settled).toBe(true);
    expect(Object.keys(result.current.bytes)).toEqual(["a"]);
    await act(async () => pending[1]!.resolve(ok(2)));
    expect(Object.keys(result.current.bytes)).toEqual(["a"]);
  });

  it("settles right away without photos", async () => {
    mockFetch();
    const { result } = await renderHook(() => useThumbBytes([], "t", true, 2500));
    expect(result.current.settled).toBe(true);
  });
});
