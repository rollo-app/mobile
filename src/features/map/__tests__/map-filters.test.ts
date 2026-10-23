import { filterActive, filterLabel } from "../map-filters";

describe("filterLabel", () => {
  it("says Filtros when nothing is filtered", () => {
    expect(filterLabel({ today: false, authorName: null })).toBe("Filtros");
  });

  it("says Hoy with only today on", () => {
    expect(filterLabel({ today: true, authorName: null })).toBe("Hoy");
  });

  it("names the person with only a person picked", () => {
    expect(filterLabel({ today: false, authorName: "Cami" })).toBe("Cami");
  });

  it("joins both when today and a person are on", () => {
    expect(filterLabel({ today: true, authorName: "Cami" })).toBe("Hoy · Cami");
  });
});

describe("filterActive", () => {
  it("is off only when nothing is filtered", () => {
    expect(filterActive({ today: false, authorName: null })).toBe(false);
    expect(filterActive({ today: true, authorName: null })).toBe(true);
    expect(filterActive({ today: false, authorName: "Cami" })).toBe(true);
    expect(filterActive({ today: true, authorName: "Cami" })).toBe(true);
  });
});
