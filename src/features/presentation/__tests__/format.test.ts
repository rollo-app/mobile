import { statCounts, topLine } from "../format";

const stats = { photos: 120, videos: 0, people: 4, days: 9, top: { name: "Fede", count: 48 } };

describe("outro formatting", () => {
  it("lists photos, people and days, and videos only when there are some", () => {
    expect(statCounts(stats).map((s) => `${s.value} ${s.label}`)).toEqual(["120 fotos", "4 personas", "9 días"]);
    expect(statCounts({ ...stats, videos: 1 }).map((s) => `${s.value} ${s.label}`)).toContain("1 video");
  });

  it("uses the singular for one", () => {
    expect(statCounts({ ...stats, photos: 1, people: 1, days: 1 }).map((s) => s.label)).toEqual(["foto", "persona", "día"]);
  });

  it("says who took the most photos, or nothing", () => {
    expect(topLine(stats)).toBe("Fede sacó más fotos: 48 fotos");
    expect(topLine({ ...stats, top: null })).toBeNull();
  });
});
