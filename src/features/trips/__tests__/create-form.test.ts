import { canCreate, defaultStart } from "../create-form";

const HOUR = 60 * 60 * 1000;
const T = Date.UTC(2027, 0, 5, 12, 0);

describe("defaultStart", () => {
  it("rounds up to the next full hour", () => {
    expect(defaultStart(T + 20 * 60 * 1000)).toBe(T + HOUR);
  });

  it("moves to the next hour even on the exact hour", () => {
    expect(defaultStart(T)).toBe(T + HOUR);
  });
});

describe("canCreate", () => {
  it("accepts both names filled in", () => {
    expect(canCreate("Sur 2027", "Juani")).toBe(true);
  });

  it("requires both names, ignoring blanks", () => {
    expect(canCreate("  ", "Juani")).toBe(false);
    expect(canCreate("Sur 2027", "")).toBe(false);
  });
});
