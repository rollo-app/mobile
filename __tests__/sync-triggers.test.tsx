import { renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { useSyncTriggers } from "@/features/capture/use-sync-triggers";

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
});
