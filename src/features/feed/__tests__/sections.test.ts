import type { MapItem } from "@/features/map/features";
import { dayTitle, groupByDay } from "../sections";

const TZ = "America/Argentina/Buenos_Aires"; // UTC-3
const NOW = Date.parse("2027-01-14T18:00:00Z"); // jueves 14, 15:00 en el viaje

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
  it("hoy y ayer según el día del viaje", () => {
    expect(dayTitle("2027-01-14", TZ, NOW)).toBe("Hoy");
    expect(dayTitle("2027-01-13", TZ, NOW)).toBe("Ayer");
  });

  it("los demás días, con día de la semana y número", () => {
    expect(dayTitle("2027-01-12", TZ, NOW)).toBe("Martes 12");
    expect(dayTitle("2027-01-03", TZ, NOW)).toBe("Domingo 3");
  });

  it("usa la zona del viaje para decidir qué es hoy", () => {
    // 02:30 UTC del 15 todavía es el 14 en Buenos Aires
    expect(dayTitle("2027-01-14", TZ, Date.parse("2027-01-15T02:30:00Z"))).toBe("Hoy");
  });
});

describe("groupByDay", () => {
  it("agrupa por día, del más nuevo al más viejo, y dentro de cada día lo último primero", () => {
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

  it("sin items no hay secciones", () => {
    expect(groupByDay([], TZ, NOW)).toEqual([]);
  });
});
