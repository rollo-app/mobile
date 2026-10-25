import type { CameraDevice, MeteringMode } from "react-native-vision-camera";

/**
 * Exposure like the iPhone's camera: a tap meters focus and exposure on that point, and dragging up or down afterwards
 * biases the exposure (EV) within the device's real range (`minExposureBias`/`maxExposureBias`, AVFoundation's
 * `min/maxExposureTargetBias`). Up is brighter.
 */
export type BiasRange = { min: number; max: number };

/** Points of vertical drag per EV stop. */
const POINTS_PER_EV = 50;

/** VoiceOver's increment/decrement: a third of a stop, like the iPhone's exposure control. */
export const EV_STEP = 1 / 3;

const clamp = (range: BiasRange, value: number) => Math.min(range.max, Math.max(range.min, value));

export function biasRange(device: Pick<CameraDevice, "supportsExposureBias" | "minExposureBias" | "maxExposureBias">): BiasRange | null {
  if (!device.supportsExposureBias || !(device.maxExposureBias > device.minExposureBias)) return null;
  return { min: device.minExposureBias, max: device.maxExposureBias };
}

/** The bias after a drag of `dy` points (negative = up) that started at `startBias`. */
export function dragBias(range: BiasRange, startBias: number, dy: number): number {
  return clamp(range, startBias - dy / POINTS_PER_EV);
}

export function stepBias(range: BiasRange, bias: number, direction: 1 | -1): number {
  return clamp(range, bias + direction * EV_STEP);
}

/** "0", "+0,7", "-1,3", "+2". */
export function formatBias(bias: number): string {
  const shown = Math.round(bias * 10) / 10;
  if (shown === 0) return "0";
  const digits = Number.isInteger(shown) ? String(Math.abs(shown)) : Math.abs(shown).toFixed(1).replace(".", ",");
  return `${shown > 0 ? "+" : "-"}${digits}`;
}

/** The sun's vertical offset on its slider (`half` points each way): each side scales to its own end of the range. */
export function sunOffset(range: BiasRange, bias: number, half: number): number {
  const end = bias >= 0 ? range.max : -range.min;
  if (end <= 0) return 0;
  return (-bias / end) * half || 0;
}

/** What a tap meters: focus, exposure and white balance, each only where the device supports it. */
export function meteringModes(
  device: Pick<CameraDevice, "supportsFocusMetering" | "supportsExposureMetering" | "supportsWhiteBalanceMetering">,
): MeteringMode[] {
  const modes: MeteringMode[] = [];
  if (device.supportsFocusMetering) modes.push("AF");
  if (device.supportsExposureMetering) modes.push("AE");
  if (device.supportsWhiteBalanceMetering) modes.push("AWB");
  return modes;
}
