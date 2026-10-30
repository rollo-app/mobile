import { test } from "node:test";
import assert from "node:assert/strict";
import { formatHour, formatRevealDate } from "./format.ts";

test("formatHour uses the offset's own clock, not the machine's zone", () => {
  process.env.TZ = "America/Montevideo";
  assert.equal(formatHour("2026-07-09T12:04:40+02:00"), "12:04");
  assert.equal(formatHour("2026-07-09T00:07:00+02:00"), "00:07");
});

test("formatRevealDate writes day, short Spanish month and year", () => {
  process.env.TZ = "America/Montevideo";
  assert.equal(formatRevealDate("2026-07-20T22:00:00+02:00"), "20 jul 2026");
  assert.equal(formatRevealDate("2026-01-05T08:00:00+02:00"), "5 ene 2026");
});
