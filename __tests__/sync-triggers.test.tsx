import { renderHook } from "@testing-library/react-native";
import { act } from "@testing-library/react-native";
import * as Network from "expo-network";
import { AppState, type AppStateStatus } from "react-native";
import { useSyncTriggers } from "@/features/capture/use-sync-triggers";

jest.mock("expo-network", () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
}));
jest.mock("@/features/capture/sync", () => ({ syncQueue: jest.fn(async () => {}) }));
jest.mock("@/features/capture/background-upload", () => ({ registerBackgroundUpload: jest.fn(async () => {}) }));
const { registerBackgroundUpload } = jest.requireMock("@/features/capture/background-upload") as {
  registerBackgroundUpload: jest.Mock;
};
const { syncQueue } = jest.requireMock("@/features/capture/sync") as { syncQueue: jest.Mock };

describe("upload triggers", () => {
  let emit: (state: AppStateStatus) => void;
  const remove = jest.fn();

  beforeEach(() => {
    syncQueue.mockClear();
    registerBackgroundUpload.mockClear();
    remove.mockClear();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      emit = handler as (state: AppStateStatus) => void;
      return { remove };
    });
  });

  it("uploads when the app opens", async () => {
    await renderHook(() => useSyncTriggers());

    expect(syncQueue).toHaveBeenCalledTimes(1);
  });

  it("uploads every time the app returns to the foreground, and not when leaving", async () => {
    await renderHook(() => useSyncTriggers());
    syncQueue.mockClear();

    emit("background");
    emit("inactive");
    expect(syncQueue).not.toHaveBeenCalled();

    emit("active");
    expect(syncQueue).toHaveBeenCalledTimes(1);
  });

  it("registers the background task on open and on every return to the foreground", async () => {
    await renderHook(() => useSyncTriggers());
    expect(registerBackgroundUpload).toHaveBeenCalledTimes(1);

    emit("background");
    expect(registerBackgroundUpload).toHaveBeenCalledTimes(1);
    emit("active");
    expect(registerBackgroundUpload).toHaveBeenCalledTimes(2);
  });

  it("stops listening on unmount", async () => {
    const { unmount } = await renderHook(() => useSyncTriggers());
    await unmount();

    expect(remove).toHaveBeenCalled();
  });

  describe("network", () => {
    let emitNet: (state: { isConnected?: boolean; isInternetReachable?: boolean }) => void;
    const removeNet = jest.fn();

    beforeEach(() => {
      jest.useFakeTimers();
      removeNet.mockClear();
      jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({ isConnected: true, isInternetReachable: true } as never);
      jest.mocked(Network.addNetworkStateListener).mockImplementation((handler) => {
        emitNet = handler as typeof emitNet;
        return { remove: removeNet } as never;
      });
    });
    afterEach(() => jest.useRealTimers());

    const mount = async () => {
      const view = await renderHook(() => useSyncTriggers());
      await act(async () => {});
      syncQueue.mockClear();
      return view;
    };

    it("syncs ignoring the backoff, after a short debounce, when the network goes from offline to online", async () => {
      await mount();

      emitNet({ isConnected: false, isInternetReachable: false });
      emitNet({ isConnected: true, isInternetReachable: true });
      expect(syncQueue).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(syncQueue).toHaveBeenCalledTimes(1);
      expect(syncQueue).toHaveBeenCalledWith({ ignoreBackoff: true });
    });

    it("does not sync from online to online", async () => {
      await mount();

      emitNet({ isConnected: true, isInternetReachable: true });
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      expect(syncQueue).not.toHaveBeenCalled();
    });

    it("a flapping network syncs once, and not if it drops again before the debounce ends", async () => {
      await mount();

      emitNet({ isInternetReachable: false });
      emitNet({ isInternetReachable: true });
      emitNet({ isInternetReachable: false });
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(syncQueue).not.toHaveBeenCalled();

      emitNet({ isInternetReachable: true });
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(syncQueue).toHaveBeenCalledTimes(1);
    });

    it("starting offline counts: reconnecting syncs", async () => {
      jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({ isConnected: false, isInternetReachable: false } as never);
      await mount();

      emitNet({ isConnected: true, isInternetReachable: true });
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      expect(syncQueue).toHaveBeenCalledTimes(1);
    });

    it("stops listening on unmount", async () => {
      const { unmount } = await mount();
      await unmount();

      expect(removeNet).toHaveBeenCalled();
    });
  });
});
