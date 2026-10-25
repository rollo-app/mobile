import type { CameraDevice, CameraOrientation, DeviceType, Size } from "react-native-vision-camera";

/**
 * Back: the virtual device with the most lenses, so iOS itself switches between ultra-wide, wide and telephoto while
 * zooming (like the iPhone's camera); a single wide lens when there is no multi-camera. Front: the wide lens (the
 * TrueDepth one adds a depth camera that only slows start-up).
 */
const RANK: Record<"back" | "front", readonly DeviceType[]> = {
  back: ["triple", "dual-wide", "dual", "wide-angle"],
  front: ["wide-angle", "true-depth"],
};

export function pickCameraDevice<T extends Pick<CameraDevice, "type" | "position">>(
  devices: readonly T[],
  facing: "back" | "front",
): T | undefined {
  const side = devices.filter((d) => d.position === facing);
  for (const type of RANK[facing]) {
    const match = side.find((d) => d.type === type);
    if (match) return match;
  }
  return side.find((d) => !d.type.endsWith("-depth")) ?? side[0];
}

/** 12 MP 4:3, for a device that lists no 4:3 photo size. */
const FALLBACK: Size = { width: 3024, height: 4032 };

/**
 * The largest 4:3 photo the device can take (48 MP where the sensor has it), upright. It is the photo output's target:
 * VisionCamera then picks the session format for it (the photo output gets a `resolutionBias` constraint).
 */
export function bestPhotoResolution(sizes: readonly Size[]): Size {
  let best: Size | undefined;
  for (const { width, height } of sizes) {
    const long = Math.max(width, height);
    const short = Math.min(width, height);
    if (Math.abs(long * 3 - short * 4) > long * 0.03) continue;
    if (!best || long * short > best.width * best.height) best = { width: short, height: long };
  }
  return best ?? FALLBACK;
}

/** The photo's size as seen: iOS stores it in the sensor's orientation with an EXIF flag, so left/right swap. */
export function uprightSize(width: number, height: number, orientation: CameraOrientation) {
  return orientation === "left" || orientation === "right" ? { width: height, height: width } : { width, height };
}
