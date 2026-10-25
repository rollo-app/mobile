import * as SecureStore from "expo-secure-store";
import { loadCameraGrid, saveCameraGrid } from "../camera-grid";

describe("camera grid preference", () => {
  it("starts off and remembers the choice under its persisted key", async () => {
    expect(await loadCameraGrid()).toBe(false);
    await saveCameraGrid(true);
    expect(await loadCameraGrid()).toBe(true);
    expect(await SecureStore.getItemAsync("rollo.cameraGrid")).toBe("1");
    await saveCameraGrid(false);
    expect(await loadCameraGrid()).toBe(false);
  });
});
