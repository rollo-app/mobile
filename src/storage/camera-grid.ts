import * as SecureStore from "expo-secure-store";

/** Whether the camera shows the rule-of-thirds grid (a phone setting). Persisted: don't rename. */
const CAMERA_GRID_KEY = "rollo.cameraGrid";

export async function loadCameraGrid(): Promise<boolean> {
  return (await SecureStore.getItemAsync(CAMERA_GRID_KEY)) === "1";
}

export async function saveCameraGrid(on: boolean): Promise<void> {
  await SecureStore.setItemAsync(CAMERA_GRID_KEY, on ? "1" : "0");
}
