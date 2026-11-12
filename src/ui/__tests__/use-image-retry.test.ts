import { act, renderHook } from "@testing-library/react-native";
import { useImageRetry } from "../use-image-retry";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

// React/RN schedule timers of their own, so look only at the calls our delays make.
const retryTimers = (spy: jest.SpyInstance) =>
  spy.mock.calls.filter(([, ms]) => [2000, 5000, 15000].includes(ms as number)).length;
let setSpy: jest.SpyInstance;
let clearSpy: jest.SpyInstance;
beforeEach(() => {
  setSpy = jest.spyOn(global, "setTimeout");
  clearSpy = jest.spyOn(global, "clearTimeout");
});
afterEach(() => jest.restoreAllMocks());

const mount = renderHook;
const advance = (ms: number) => act(async () => void jest.advanceTimersByTime(ms));

describe("useImageRetry", () => {
  it("starts on attempt 0 with no timer", async () => {
    const { result } = await mount(() => useImageRetry());
    expect(result.current.attempt).toBe(0);
    expect(retryTimers(setSpy)).toBe(0);
  });

  it("bumps the key after 2 s, 5 s and 15 s of failures, then stops", async () => {
    const { result } = await mount(() => useImageRetry());
    await act(async () => void result.current.onError());
    await advance(1999);
    expect(result.current.attempt).toBe(0);
    await advance(1);
    expect(result.current.attempt).toBe(1);

    await act(async () => void result.current.onError());
    await advance(4999);
    expect(result.current.attempt).toBe(1);
    await advance(1);
    expect(result.current.attempt).toBe(2);

    await act(async () => void result.current.onError());
    await advance(14999);
    expect(result.current.attempt).toBe(2);
    await advance(1);
    expect(result.current.attempt).toBe(3);

    await act(async () => void result.current.onError());
    await advance(60000);
    expect(result.current.attempt).toBe(3);
    expect(retryTimers(setSpy)).toBe(3); // the 4th failure scheduled nothing
  });

  it("does not stack timers when onError fires twice in a row", async () => {
    const { result } = await mount(() => useImageRetry());
    await act(async () => {
      result.current.onError();
      result.current.onError();
    });
    expect(retryTimers(setSpy)).toBe(1);
    await advance(2000);
    expect(result.current.attempt).toBe(1);
  });

  it("starts over from 2 s after a successful load", async () => {
    const { result } = await mount(() => useImageRetry());
    await act(async () => void result.current.onError());
    await advance(2000);
    await act(async () => void result.current.onError());
    await advance(5000);
    expect(result.current.attempt).toBe(2);
    await act(async () => void result.current.onLoad());
    await act(async () => void result.current.onError());
    await advance(2000);
    expect(result.current.attempt).toBe(3);
  });

  it("onLoad cancels a pending retry", async () => {
    const { result } = await mount(() => useImageRetry());
    await act(async () => void result.current.onError());
    await act(async () => void result.current.onLoad());
    await advance(10000);
    expect(result.current.attempt).toBe(0);
  });

  it("cancels the pending retry on unmount", async () => {
    const { result, unmount } = await mount(() => useImageRetry());
    await act(async () => void result.current.onError());
    const handle = setSpy.mock.results[setSpy.mock.calls.findIndex(([, ms]) => ms === 2000)]!.value;
    await unmount();
    expect(clearSpy).toHaveBeenCalledWith(handle);
  });

  it("forgets the failures when the image it shows changes", async () => {
    const { result, rerender } = await mount((p: { id: string }) => useImageRetry(p.id), { initialProps: { id: "a" } });
    await act(async () => void result.current.onError());
    await advance(2000);
    await act(async () => void result.current.onError());
    await advance(5000);
    await act(async () => void result.current.onError());
    await advance(15000);
    expect(result.current.attempt).toBe(3);
    await rerender({ id: "b" });
    await act(async () => void result.current.onError());
    await advance(2000);
    expect(result.current.attempt).toBe(4);
  });

  it("gives every image its own key, so sibling images never share one", async () => {
    const { result } = await mount(() => [useImageRetry("a"), useImageRetry("b")]);
    const [first, second] = result.current;
    expect(first!.retryKey).not.toBe(second!.retryKey);
  });

  it("changes the key on each retry", async () => {
    const { result } = await mount(() => useImageRetry("a"));
    const before = result.current.retryKey;
    await act(async () => void result.current.onError());
    await advance(2000);
    expect(result.current.retryKey).not.toBe(before);
  });
});
