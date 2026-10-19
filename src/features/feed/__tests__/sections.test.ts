import type { MapItem } from "@/features/map/features";
import { dayTitle, groupByDay, newest } from "../sections";

const TZ = "America/Argentina/Buenos_Aires"; // UTC-3
const NOW = Date.parse("2027-01-14T18:00:00Z"); // Thursday 14th, 15:00 in the trip

const item = (id: string, day: string, takenAt: number): MapItem => ({
  id,
  type: "photo",
  takenAt,
  day,
  lat: null,
  lng: null,
  caption: null,
  durationS: null,
  thumbhash: null,
  authorId: "m1",
  authorName: "Juani",
  pending: false,
});

describe("dayTitle", () => {
  it("today and yesterday according to the trip day", () => {
    expect(dayTitle("2027-01-14", TZ, NOW)).toBe("Hoy");
    expect(dayTitle("2027-01-13", TZ, NOW)).toBe("Ayer");
  });

  it("other days, with weekday and number", () => {
    expect(dayTitle("2027-01-12", TZ, NOW)).toBe("Martes 12");
    expect(dayTitle("2027-01-03", TZ, NOW)).toBe("Domingo 3");
  });

  it("uses the trip's zone to decide what today is", () => {
    // 02:30 UTC on the 15th is still the 14th in Buenos Aires
    expect(dayTitle("2027-01-14", TZ, Date.parse("2027-01-15T02:30:00Z"))).toBe("Hoy");
  });
});

describe("groupByDay", () => {
  it("groups by day, newest to oldest, and within each day the latest first", () => {
    const sections = groupByDay(
      [item("a", "2027-01-12", 1), item("b", "2027-01-14", 5), item("c", "2027-01-12", 3), item("d", "2027-01-13", 2)],
      TZ,
      NOW,
    );

    expect(sections.map((s) => [s.title, s.data.map((i) => i.id)])).toEqual([
      ["Hoy", ["b"]],
      ["Ayer", ["d"]],
      ["Martes 12", ["c", "a"]],
    ]);
  });

  it("with no items there are no sections", () => {
    expect(groupByDay([], TZ, NOW)).toEqual([]);
  });
});

describe("newest", () => {
  it("keeps the N most recent by capture time", () => {
    const items = [item("a", "2027-01-12", 1), item("b", "2027-01-12", 4), item("c", "2027-01-13", 3), item("d", "2027-01-13", 2)];
    expect(newest(items, 2).map((i) => i.id)).toEqual(["b", "c"]);
  });

  it("with a limit larger than the count returns everything", () => {
    expect(newest([item("a", "2027-01-12", 1)], 10)).toHaveLength(1);
  });
});
