import { formatAgo } from "../relative-time";

const NOW = Date.parse("2027-01-14T12:00:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatAgo", () => {
  it("says ahora for the first minute (and for a clock a bit ahead)", () => {
    expect(formatAgo(NOW - 20_000, NOW)).toBe("ahora");
    expect(formatAgo(NOW + 5_000, NOW)).toBe("ahora");
  });

  it("counts minutes, hours and days", () => {
    expect(formatAgo(NOW - 5 * MIN, NOW)).toBe("hace 5 min");
    expect(formatAgo(NOW - 59 * MIN, NOW)).toBe("hace 59 min");
    expect(formatAgo(NOW - 2 * HOUR, NOW)).toBe("hace 2 h");
    expect(formatAgo(NOW - 23 * HOUR, NOW)).toBe("hace 23 h");
    expect(formatAgo(NOW - 3 * DAY, NOW)).toBe("hace 3 d");
  });

  it("falls back to the date after a week", () => {
    expect(formatAgo(Date.parse("2027-01-02T12:00:00Z"), NOW)).toBe("2 ene");
  });
});
