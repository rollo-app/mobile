import { descriptionPreview } from "../description-preview";

describe("descriptionPreview", () => {
  it("is empty without a description", () => {
    expect(descriptionPreview(null)).toBeUndefined();
    expect(descriptionPreview("  \nx")).toBeUndefined();
  });
  it("keeps a short first line and drops the rest", () => {
    expect(descriptionPreview("Hola\nChau")).toBe("Hola");
  });
  it("cuts a long line with an ellipsis", () => {
    expect(descriptionPreview("a".repeat(50))).toBe(`${"a".repeat(30)}…`);
  });
});
