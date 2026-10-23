import { formatPinTime } from "../pin-time";

const TZ = "America/Argentina/Buenos_Aires"; // UTC-3
const at = (iso: string) => Date.parse(iso);

describe("formatPinTime", () => {
  const now = at("2027-01-14T18:00:00Z"); // Thursday 14th, 15:00 in the trip

  it("today with the trip time", () => {
    expect(formatPinTime(at("2027-01-14T16:10:00Z"), TZ, now)).toBe("hoy 13:10");
  });

  it("yesterday", () => {
    expect(formatPinTime(at("2027-01-14T00:40:00Z"), TZ, now)).toBe("ayer 21:40");
  });

  it("earlier days with weekday and number", () => {
    expect(formatPinTime(at("2027-01-11T16:10:00Z"), TZ, now)).toBe("lun 11 · 13:10");
  });

  it("uses the trip's zone, not the phone's, to decide the day", () => {
    // 02:30 UTC on the 15th is still the 14th at 23:30 in Buenos Aires
    expect(formatPinTime(at("2027-01-15T02:30:00Z"), TZ, now)).toBe("hoy 23:30");
  });
});
