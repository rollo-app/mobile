import type { CameraDevice } from "react-native-vision-camera";

/**
 * The zoom like the iPhone's camera, from the device's real data.
 *
 * VisionCamera hands over AVFoundation's numbers: a virtual device's zoom factor 1 is its widest lens (the ultra-wide on a
 * triple camera), and `zoomLensSwitchFactors` (`virtualDeviceSwitchOverVideoZoomFactors`) are the factors where iOS hands
 * over to the next lens. So:
 * - "1×" (`neutral`) is the wide lens: the first switch-over when the device has an ultra-wide, else its minimum.
 * - "0,5" is the minimum, only with an ultra-wide.
 * - Each later switch-over is a telephoto, in × of the wide lens (triple [2, 6] → 3×, [2, 10] → 5×).
 * - The pinch goes from the minimum to 5× the longest telephoto (15× on a 3×, 25× on a 5×, like the iPhone) or 10×
 *   without one, never past what the device can do.
 * `presets` and every "factor" are in × of the wide lens (what the user reads); `neutral`/`min`/`max` are raw device zoom.
 */
export type ZoomDevice = Pick<CameraDevice, "position" | "minZoom" | "maxZoom" | "zoomLensSwitchFactors"> & {
  physicalDevices: readonly Pick<CameraDevice, "type">[];
};

export type ZoomLevels = { neutral: number; min: number; max: number; presets: number[] };

const round1 = (n: number) => Math.round(n * 10) / 10;

export function zoomLevels(device: ZoomDevice): ZoomLevels {
  const lenses = device.physicalDevices.map((d) => d.type);
  const ultraWide = lenses.includes("ultra-wide-angle") && device.zoomLensSwitchFactors.length > 0;
  const neutral = ultraWide ? device.zoomLensSwitchFactors[0]! : device.minZoom;
  const teles = lenses.includes("telephoto")
    ? device.zoomLensSwitchFactors.filter((f) => f > neutral + 0.01).map((f) => round1(f / neutral))
    : [];
  const longest = Math.max(0, ...teles);
  const max = Math.min(device.maxZoom, neutral * Math.max(10, 5 * longest));

  let presets: number[] = [];
  if (device.position === "back") {
    const candidates = [...(ultraWide ? [round1(device.minZoom / neutral)] : []), 1, 2, ...teles];
    presets = [...new Set(candidates)].filter((p) => p * neutral <= max + 0.001).sort((a, b) => a - b);
  }
  return { neutral, min: device.minZoom, max, presets };
}

/** The chip that holds the current zoom: the largest one at or under it (as shown, rounded to one decimal). */
export function activePreset(presets: readonly number[], factor: number): number | undefined {
  const shown = round1(factor);
  let active = presets[0];
  for (const p of presets) if (p <= shown) active = p;
  return active;
}

/** "0,5", "1", "1,4": one decimal with a comma, none for whole numbers. */
export function formatFactor(factor: number): string {
  const shown = round1(factor);
  return Number.isInteger(shown) ? String(shown) : shown.toFixed(1).replace(".", ",");
}

export type Touch = { pageX: number; pageY: number };

export function touchDistance(touches: readonly Touch[]) {
  const [a, b] = touches;
  return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
}

/** The raw zoom after fingers that started `startDistance` apart (at `startZoom`) are now `distance` apart. */
export function pinchZoom(levels: ZoomLevels, startZoom: number, startDistance: number, distance: number) {
  if (startDistance <= 0) return startZoom;
  return Math.min(levels.max, Math.max(levels.min, startZoom * (distance / startDistance)));
}
