import { featuredDisplayPath } from "../display-path";

describe("featuredDisplayPath", () => {
  it("points a featured photo's original path at its display variant", () => {
    expect(featuredDisplayPath("/featured/u1/m1/original")).toBe("/featured/u1/m1/display");
  });

  it("leaves any other path alone", () => {
    expect(featuredDisplayPath("/featured/u1/m1/thumb")).toBe("/featured/u1/m1/thumb");
  });
});
