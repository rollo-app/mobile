import { renderHook, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { markAppIntroPending, takeAppIntroPending } from "@/storage/app-intro";
import { useAppIntro } from "../use-app-intro";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
const push = jest.mocked(router.push);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => push.mockReset());

describe("useAppIntro", () => {
  it("does nothing when the intro is not pending", async () => {
    await renderHook(() => useAppIntro());
    await flush();
    expect(push).not.toHaveBeenCalled();
  });

  it("opens the intro once when pending", async () => {
    await markAppIntroPending();
    const hook = await renderHook(() => useAppIntro());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/intro"));
    await hook.unmount();
    await renderHook(() => useAppIntro());
    await flush();
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("opens it once when two checks overlap", async () => {
    await markAppIntroPending();
    await renderHook(() => {
      useAppIntro();
      useAppIntro();
    });
    await flush();
    await flush();
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("does not open it when this phone already showed it", async () => {
    await markAppIntroPending();
    await takeAppIntroPending();
    await markAppIntroPending();
    await renderHook(() => useAppIntro());
    await flush();
    expect(push).not.toHaveBeenCalled();
  });
});
