import { act, renderHook } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { useSelfTimer } from "../use-self-timer";

jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn().mockResolvedValue(undefined) }));

describe("useSelfTimer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it("shoots right away with the timer off", async () => {
    const shoot = jest.fn().mockResolvedValue(undefined);
    const { result } = await renderHook(() => useSelfTimer(shoot));
    await act(async () => result.current.onShutter());
    expect(shoot).toHaveBeenCalledTimes(1);
    expect(result.current.countdown).toBeNull();
  });

  it("cycles the delay and counts down to a shot, ticking each second but the last", async () => {
    const shoot = jest.fn().mockResolvedValue(undefined);
    const { result } = await renderHook(() => useSelfTimer(shoot));
    await act(async () => result.current.cycleTimer());
    expect(result.current.timer).toBe(3);
    await act(async () => result.current.onShutter());
    expect(result.current.countdown).toBe(3);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.countdown).toBe(2);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.countdown).toBe(1);
    expect(shoot).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(shoot).toHaveBeenCalledTimes(1);
    expect(result.current.countdown).toBeNull();
  });

  it("cancels the countdown when the shutter is pressed again", async () => {
    const shoot = jest.fn().mockResolvedValue(undefined);
    const { result } = await renderHook(() => useSelfTimer(shoot));
    await act(async () => result.current.cycleTimer());
    await act(async () => result.current.onShutter());
    await act(async () => result.current.onShutter());
    expect(result.current.countdown).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(shoot).not.toHaveBeenCalled();
  });
});
