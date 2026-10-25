import { centerCropTo43 } from "../frame";

describe("centerCropTo43", () => {
  it("leaves a 4:3 photo alone, in either orientation", () => {
    expect(centerCropTo43(3024, 4032)).toBeNull();
    expect(centerCropTo43(4032, 3024)).toBeNull();
  });

  it("tolerates a pixel or two of rounding", () => {
    expect(centerCropTo43(3023, 4032)).toBeNull();
  });

  it("crops a taller portrait photo to 3:4 around the center", () => {
    // 9:16 -> 3:4: the width stays, the height shrinks.
    expect(centerCropTo43(2250, 4000)).toEqual({ originX: 0, originY: 500, width: 2250, height: 3000 });
  });

  it("crops a wider landscape photo to 4:3 around the center", () => {
    expect(centerCropTo43(4000, 2250)).toEqual({ originX: 500, originY: 0, width: 3000, height: 2250 });
  });

  it("treats a square photo as portrait", () => {
    expect(centerCropTo43(3000, 3000)).toEqual({ originX: 375, originY: 0, width: 2250, height: 3000 });
  });
});
