import { cellFill } from "../cell-fill";

describe("cellFill", () => {
  it("develops the photo through the shader when both are ready", () => {
    expect(cellFill(true, true)).toBe("develop");
  });

  it("draws the photo as is when the shader didn't compile", () => {
    expect(cellFill(false, true)).toBe("image");
  });

  it("draws the ThumbHash color while the photo loads, with or without the shader", () => {
    expect(cellFill(true, false)).toBe("color");
    expect(cellFill(false, false)).toBe("color");
  });
});
