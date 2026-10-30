import { MAX_DAILY_PHOTOS, MAX_TOTAL_PHOTOS, canCreate, dateAtMinutes, DEFAULT_MOMENT_WINDOW, defaultStart, effectiveStart, endAfter, minutesOfDay, revealNotBefore } from "../create-form";

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

describe("moment window helpers", () => {
  it("converts a picked date to minutes from local midnight", () => {
    expect(minutesOfDay(new Date(2027, 0, 5, 22, 15))).toBe(22 * 60 + 15);
    expect(minutesOfDay(new Date(2027, 0, 5, 0, 0))).toBe(0);
  });

  it("builds a date whose local time is the given minutes", () => {
    const d = dateAtMinutes(1380);
    expect([d.getHours(), d.getMinutes()]).toEqual([23, 0]);
  });

  it("has the default window 9:00 to 23:00", () => {
    expect(DEFAULT_MOMENT_WINDOW).toEqual({ start: 540, end: 1380 });
  });
});

it("exposes the photo caps the server enforces", () => {
  expect(MAX_DAILY_PHOTOS).toBe(30);
  expect(MAX_TOTAL_PHOTOS).toBe(200);
});
