import { renderHook } from "@testing-library/react-native";
import * as Network from "expo-network";
import { AppState, type AppStateStatus } from "react-native";
import { useRetryPendingLogouts } from "@/features/auth/use-retry-pending-logouts";

jest.mock("@/features/auth/pending-logout", () => ({ retryPendingLogouts: jest.fn(async () => {}) }));
const { retryPendingLogouts } = jest.requireMock("@/features/auth/pending-logout") as { retryPendingLogouts: jest.Mock };

describe("pending logout triggers", () => {
  let emit: (state: AppStateStatus) => void;
  let emitNet: (state: { isConnected?: boolean; isInternetReachable?: boolean }) => void;
  const remove = jest.fn();
  const removeNet = jest.fn();

  beforeEach(() => {
    retryPendingLogouts.mockClear();
    remove.mockClear();
    removeNet.mockClear();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      emit = handler as (state: AppStateStatus) => void;
      return { remove };
    });
    jest.mocked(Network.addNetworkStateListener).mockImplementation((handler) => {
      emitNet = handler as typeof emitNet;
      return { remove: removeNet } as never;
    });
  });

  it("retries when the app opens", async () => {
    await renderHook(() => useRetryPendingLogouts());

    expect(retryPendingLogouts).toHaveBeenCalledTimes(1);
  });

  it("retries on every return to the foreground, not when leaving", async () => {
    await renderHook(() => useRetryPendingLogouts());
    retryPendingLogouts.mockClear();

    emit("background");
    expect(retryPendingLogouts).not.toHaveBeenCalled();
    emit("active");
    expect(retryPendingLogouts).toHaveBeenCalledTimes(1);
  });

  it("retries when the network comes back, not when it goes", async () => {
    await renderHook(() => useRetryPendingLogouts());
    retryPendingLogouts.mockClear();

    emitNet({ isConnected: false, isInternetReachable: false });
    expect(retryPendingLogouts).not.toHaveBeenCalled();
    emitNet({ isConnected: true, isInternetReachable: true });
    expect(retryPendingLogouts).toHaveBeenCalledTimes(1);
  });

  it("stops listening on unmount", async () => {
    const { unmount } = await renderHook(() => useRetryPendingLogouts());
    await unmount();

    expect(remove).toHaveBeenCalled();
    expect(removeNet).toHaveBeenCalled();
  });
});
