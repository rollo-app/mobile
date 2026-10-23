import { canCreate, defaultStart, effectiveStart, endAfter, revealNotBefore } from "../create-form";

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
  it("accepts a name", () => {
    expect(canCreate("Sur 2027")).toBe(true);
  });

  it("requires a name, ignoring blanks", () => {
    expect(canCreate("  ")).toBe(false);
    expect(canCreate("")).toBe(false);
  });
});

describe("effectiveStart", () => {
  it("uses the moment of submit when starting now", () => {
    expect(effectiveStart("now", T + HOUR, T)).toBe(T);
  });

  it("uses the chosen date for another date", () => {
    expect(effectiveStart("custom", T + HOUR, T)).toBe(T + HOUR);
  });
});

describe("endAfter", () => {
  it("keeps an end that is after the start", () => {
    expect(endAfter(T + HOUR, T)).toBe(T + HOUR);
  });

  it("moves an end that is not after the start to start + 72 h", () => {
    expect(endAfter(T, T)).toBe(T + 72 * HOUR);
    expect(endAfter(T - HOUR, T)).toBe(T + 72 * HOUR);
  });
});

describe("revealNotBefore", () => {
  it("keeps a reveal at or after the end", () => {
    expect(revealNotBefore(T + HOUR, T)).toBe(T + HOUR);
    expect(revealNotBefore(T, T)).toBe(T);
  });

  it("moves a reveal before the end to end + 12 h", () => {
    expect(revealNotBefore(T - HOUR, T)).toBe(T + 12 * HOUR);
  });
});
