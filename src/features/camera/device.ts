import type { CameraDevice, CameraOrientation, DeviceType, Size } from "react-native-vision-camera";

/**
 * Back: the virtual device with the most lenses, so iOS itself switches between ultra-wide, wide and telephoto while
 * zooming (like the iPhone's camera); a single wide lens when there is no multi-camera. Front: the wide lens (the
 * TrueDepth one adds a depth camera that only slows start-up).
 */
const RANK: Record<"back" | "front", readonly DeviceType[]> = {
  back: ["quad", "triple", "dual-wide", "dual", "wide-angle"],
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

/** ~24 MP: the photo is resized to 4000 px before upload, so 48 MP would only add noise, latency and ~25 MB temp files. */
const MAX_PIXELS = 24_500_000;

/**
 * The photo output's target: the largest 4:3 photo the device can take up to ~24 MP (5712×4284 where the sensor offers it,
 * else 4032×3024), upright; if every 4:3 size is over the cap, the smallest of them. VisionCamera then picks the session
 * format for it (the photo output gets a `resolutionBias` constraint).
 */
export function bestPhotoResolution(sizes: readonly Size[]): Size {
  const fourThree = sizes
    .map(({ width, height }) => ({ width: Math.min(width, height), height: Math.max(width, height) }))
    // Long side over short side within 1 % of 4/3 (sensor sizes are not always exact).
    .filter(({ width, height }) => Math.abs(height / width - 4 / 3) <= (4 / 3) * 0.01)
    .sort((a, b) => a.width * a.height - b.width * b.height);
  const underCap = fourThree.filter((s) => s.width * s.height <= MAX_PIXELS);
  return underCap.at(-1) ?? fourThree[0] ?? FALLBACK;
}

/** The photo's size as seen: iOS stores it in the sensor's orientation with an EXIF flag, so left/right swap. */
export function uprightSize(width: number, height: number, orientation: CameraOrientation) {
  return orientation === "left" || orientation === "right" ? { width: height, height: width } : { width, height };
}
