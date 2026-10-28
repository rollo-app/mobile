import { act, renderHook } from "@testing-library/react-native";
import type { StoryStep } from "../story";
import { useStoryClock } from "../use-story-clock";

const day = (label: string): StoryStep => ({ kind: "day", day: label, label, count: 1 }) as unknown as StoryStep;

describe("useStoryClock", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const setup = async (over: Partial<Parameters<typeof useStoryClock>[0]> = {}) => {
    const dispatch = jest.fn();
    const steps = [day("a"), day("b")];
    const props = { steps, index: 0, step: steps[0]!, paused: false, screenReader: false, dispatch, ...over };
    const hook = await renderHook((p: typeof props) => useStoryClock(p), { initialProps: props });
    return { dispatch, props, ...hook };
  };

  it("dispatches next when the step duration runs out", async () => {
    const { dispatch } = await setup();
    expect(dispatch).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(dispatch).toHaveBeenCalledWith({ type: "next" });
  });

  it("does not advance while paused or with a screen reader", async () => {
    const paused = await setup({ paused: true });
    const reader = await setup({ screenReader: true });
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(paused.dispatch).not.toHaveBeenCalled();
    expect(reader.dispatch).not.toHaveBeenCalled();
  });

  it("does not load on the first render, but does when the steps change", async () => {
    const { dispatch, props, rerender } = await setup({ paused: true });
    expect(dispatch).not.toHaveBeenCalled();
    const steps = [day("c")];
    await rerender({ ...props, steps, step: steps[0]! });
    expect(dispatch).toHaveBeenCalledWith({ type: "load", steps });
  });
});
