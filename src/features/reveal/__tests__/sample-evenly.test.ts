import { sampleEvenly } from "../sample-evenly";

describe("sampleEvenly", () => {
  it("keeps everything when it fits", () => {
    expect(sampleEvenly([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });

  it("spreads the picks over the whole list", () => {
    const picked = sampleEvenly(Array.from({ length: 200 }, (_, i) => i), 30);
    expect(picked).toHaveLength(30);
    expect(picked[0]).toBe(0);
    expect(picked.at(-1)).toBeGreaterThan(180);
  });

  it("never repeats an item", () => {
    const picked = sampleEvenly(Array.from({ length: 13 }, (_, i) => i), 12);
    expect(new Set(picked).size).toBe(12);
  });
});
