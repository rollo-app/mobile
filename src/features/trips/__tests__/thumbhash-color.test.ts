import { thumbHashAverageColor } from "../thumbhash-color";

// Hashes generated with the reference encoder (`thumbhash` package) from solid 16×16 images.
describe("thumbHashAverageColor", () => {
  it.each([
    ["1fsDBwBnaix4iIdyeJiHeIeIgMB3CHwH", { r: 254, g: 0, b: 1 }],
    ["FQACBwBnaix4iIdyeJiHeIeIcD+IAAAA", { r: 2, g: 0, b: 255 }],
    ["IAgCBwBqeix3eIeHePh3N4h4BQAAAAAA", { r: 133, g: 129, b: 127 }],
    ["n7IBBwBoah13d3h3eId3d4h3cE+I94gI", { r: 49, g: 86, b: 242 }],
    ["1QcSHQRnh493V4dIh4eXh1h4kJUI", { r: 86, g: 82, b: 88 }],
  ])("decodes the average color of %s", (hash, rgb) => {
    expect(thumbHashAverageColor(hash)).toEqual(rgb);
  });

  it("is null for an empty or too short hash", () => {
    expect(thumbHashAverageColor("")).toBeNull();
    expect(thumbHashAverageColor("AAA")).toBeNull();
  });

  it("is null for something that isn't base64", () => {
    expect(thumbHashAverageColor("no es base64!!")).toBeNull();
  });
});
