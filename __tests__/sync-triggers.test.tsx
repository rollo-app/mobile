import { renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { useSyncTriggers } from "@/features/capture/use-sync-triggers";

jest.mock("@/features/capture/sync", () => ({ syncQueue: jest.fn(async () => {}) }));
const { syncQueue } = jest.requireMock("@/features/capture/sync") as { syncQueue: jest.Mock };

describe("disparadores de la subida", () => {
  let emit: (state: AppStateStatus) => void;
  const remove = jest.fn();

  beforeEach(() => {
    syncQueue.mockClear();
    remove.mockClear();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      emit = handler as (state: AppStateStatus) => void;
      return { remove };
    });
  });

  it("sube al abrir la app", async () => {
    await renderHook(() => useSyncTriggers());

    expect(syncQueue).toHaveBeenCalledTimes(1);
  });

  it("sube cada vez que la app vuelve a primer plano, y no al irse", async () => {
    await renderHook(() => useSyncTriggers());
    syncQueue.mockClear();

    emit("background");
    emit("inactive");
    expect(syncQueue).not.toHaveBeenCalled();

    emit("active");
    expect(syncQueue).toHaveBeenCalledTimes(1);
  });

  it("deja de escuchar al desmontar", async () => {
    const { unmount } = await renderHook(() => useSyncTriggers());
    await unmount();

    expect(remove).toHaveBeenCalled();
  });
});
