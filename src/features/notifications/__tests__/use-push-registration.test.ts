import { act, renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { usePushRegistration } from "../use-push-registration";

jest.mock("../push-token", () => ({ syncPushToken: jest.fn(async () => {}) }));
const { syncPushToken } = jest.requireMock("../push-token") as { syncPushToken: jest.Mock };

describe("usePushRegistration", () => {
  let emit: (state: AppStateStatus) => void;
  const remove = jest.fn();

  beforeEach(() => {
    syncPushToken.mockClear();
    remove.mockClear();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      emit = handler as (state: AppStateStatus) => void;
      return { remove };
    });
  });

  it("registers when the account is ready and on every return to the foreground", async () => {
    await renderHook(() => usePushRegistration(true));
    expect(syncPushToken).toHaveBeenCalledTimes(1);

    await act(async () => emit("background"));
    expect(syncPushToken).toHaveBeenCalledTimes(1);
    await act(async () => emit("active"));
    expect(syncPushToken).toHaveBeenCalledTimes(2);
  });

  it("does nothing until the account is ready (signed in, profile complete)", async () => {
    const { rerender } = await renderHook(({ ready }: { ready: boolean }) => usePushRegistration(ready), { initialProps: { ready: false } });
    expect(syncPushToken).not.toHaveBeenCalled();

    await rerender({ ready: true });
    expect(syncPushToken).toHaveBeenCalledTimes(1);
  });

  it("stops listening when signed out", async () => {
    const { rerender } = await renderHook(({ ready }: { ready: boolean }) => usePushRegistration(ready), { initialProps: { ready: true } });
    await rerender({ ready: false });
    expect(remove).toHaveBeenCalled();
  });
});
