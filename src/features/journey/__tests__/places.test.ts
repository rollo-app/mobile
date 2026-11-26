import { stopLabels } from "../places";

const a = (city: string | null, country: string | null = "Argentina") => ({ city, country });

describe("stopLabels", () => {
  it("gives the city alone when every stop is in one country", () => {
    expect(stopLabels([a("Bariloche"), a("El Bolsón")], true)).toEqual(["Bariloche", "El Bolsón"]);
  });

  it("adds the country when the stops span more than one", () => {
    expect(stopLabels([a("Budva", "Montenegro"), a("Split", "Croatia")], true)).toEqual(["Budva, Montenegro", "Split, Croatia"]);
  });

  it("gives the city twice, never the spot, when city only", () => {
    expect(stopLabels([a("Tandil"), a("Tandil")], true, ["Centro", "Parque"])).toEqual(["Tandil", "Tandil"]);
  });

  it("tells stops in the same city apart by their spot when not city only", () => {
    expect(stopLabels([a("Tandil"), a("Tandil")], false, ["Centro", "Parque"])).toEqual(["Centro", "Parque"]);
  });

  it("falls back to the city when a repeated stop has no spot", () => {
    expect(stopLabels([a("Tandil"), a("Tandil")], false, ["Centro", null])).toEqual(["Centro", "Tandil"]);
  });

  it("gives null for a stop with no address", () => {
    expect(stopLabels([null, a("Bariloche")], true)).toEqual([null, "Bariloche"]);
  });

  it("falls back to the country when there is no city", () => {
    expect(stopLabels([a(null, "Chile")], true)).toEqual(["Chile"]);
  });
});
