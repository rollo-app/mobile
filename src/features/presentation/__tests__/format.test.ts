import { formatCount, galleryLabel, statCounts, topLine } from "../format";

const stats = { photos: 120, videos: 0, people: 4, days: 9, top: { name: "Fede", count: 48 }, trimmed: false };

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

  it("formats big counts with the es-AR thousands separator", () => {
    expect(formatCount(7)).toBe("7");
    expect(formatCount(2000)).toBe("2.000");
    expect(formatCount(1234567)).toBe("1.234.567");
  });

  it("labels the gallery action with the total", () => {
    expect(galleryLabel({ ...stats, photos: 1800, videos: 200 })).toBe("Ver las 2.000 fotos en la galería");
  });
});
