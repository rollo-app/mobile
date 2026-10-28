import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { useCameraGrid } from "../use-camera-grid";

describe("useCameraGrid", () => {
  it("starts off and toggles, remembering the choice", async () => {
    const { result } = await renderHook(() => useCameraGrid());
    expect(result.current.grid).toBe(false);
    await act(async () => result.current.toggleGrid());
    expect(result.current.grid).toBe(true);
    await waitFor(async () => expect(await SecureStore.getItemAsync("rollo.cameraGrid")).toBe("1"));
  });

  it("restores a saved grid", async () => {
    await SecureStore.setItemAsync("rollo.cameraGrid", "1");
    const { result } = await renderHook(() => useCameraGrid());
    await waitFor(() => expect(result.current.grid).toBe(true));
  });
});
