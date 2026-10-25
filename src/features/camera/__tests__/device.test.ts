import type { DeviceType } from "react-native-vision-camera";
import { bestPhotoResolution, pickCameraDevice, uprightSize } from "../device";

type Dev = { id: string; type: DeviceType; position: "back" | "front" };
const dev = (id: string, type: DeviceType, position: "back" | "front"): Dev => ({ id, type, position });

describe("pickCameraDevice", () => {
  const all = [
    dev("wide", "wide-angle", "back"),
    dev("ultra", "ultra-wide-angle", "back"),
    dev("tele", "telephoto", "back"),
    dev("dual", "dual", "back"),
    dev("dualWide", "dual-wide", "back"),
    dev("triple", "triple", "back"),
    dev("lidar", "lidar-depth", "back"),
    dev("truedepth", "true-depth", "front"),
    dev("front", "wide-angle", "front"),
  ];

  it("on the back takes the multi-camera with the most lenses so iOS switches lenses by itself", () => {
    expect(pickCameraDevice(all, "back")?.id).toBe("triple");
    expect(pickCameraDevice(all.filter((d) => d.id !== "triple"), "back")?.id).toBe("dualWide");
    expect(pickCameraDevice(all.filter((d) => !["triple", "dualWide"].includes(d.id)), "back")?.id).toBe("dual");
  });

  it("without a multi-camera it takes the wide lens", () => {
    expect(pickCameraDevice([dev("ultra", "ultra-wide-angle", "back"), dev("wide", "wide-angle", "back")], "back")?.id).toBe("wide");
  });

  it("on the front takes the wide lens, not the depth camera", () => {
    expect(pickCameraDevice(all, "front")?.id).toBe("front");
  });

  it("falls back to any camera on that side, and to nothing when there is none", () => {
    expect(pickCameraDevice([dev("truedepth", "true-depth", "front")], "front")?.id).toBe("truedepth");
    expect(pickCameraDevice([], "back")).toBeUndefined();
  });
});

describe("bestPhotoResolution", () => {
  it("takes the largest 4:3 photo size, upright", () => {
    const sizes = [
      { width: 4032, height: 3024 },
      { width: 8064, height: 6048 },
      { width: 5712, height: 4284 },
      { width: 9000, height: 5063 }, // 16:9, larger but the wrong shape
    ];
    expect(bestPhotoResolution(sizes)).toEqual({ width: 6048, height: 8064 });
  });

  it("without any 4:3 size it asks for 12 MP 4:3", () => {
    expect(bestPhotoResolution([{ width: 3840, height: 2160 }])).toEqual({ width: 3024, height: 4032 });
    expect(bestPhotoResolution([])).toEqual({ width: 3024, height: 4032 });
  });
});

describe("uprightSize", () => {
  it("swaps width and height when the photo is stored rotated (EXIF left/right)", () => {
    expect(uprightSize(4032, 3024, "right")).toEqual({ width: 3024, height: 4032 });
    expect(uprightSize(4032, 3024, "left")).toEqual({ width: 3024, height: 4032 });
  });

  it("keeps them when it is stored upright or upside down", () => {
    expect(uprightSize(3024, 4032, "up")).toEqual({ width: 3024, height: 4032 });
    expect(uprightSize(4032, 3024, "down")).toEqual({ width: 4032, height: 3024 });
  });
});
