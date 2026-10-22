import type { RevealedPhoto } from "@/features/media/revealed";
import { authorsOf, chunkRows, dayTitle, filterByAuthor, groupByDay } from "../group";

const photo = (id: string, day: string, authorId = "m1", takenAt = 0): RevealedPhoto => ({
  id,
  type: "photo",
  takenAt,
  day,
  lat: null,
  lng: null,
  caption: null,
  durationS: null,
  width: null,
  height: null,
  thumbhash: null,
  author: { id: authorId, userId: `u-${authorId}`, name: authorId, username: null, avatarUrl: null },
  thumbPath: `/t/${id}`,
  originalPath: `/o/${id}`,
  authorUserId: "u-m1",
  featuredByMe: false,
  featureBlocked: false,
});

describe("gallery grouping", () => {
  it("titles a day with weekday, number and month", () => {
    expect(dayTitle("2027-01-12")).toBe("Martes 12 de enero");
    expect(dayTitle("2027-02-01")).toBe("Lunes 1 de febrero");
  });

  it("groups by day keeping the order of the photos", () => {
    const sections = groupByDay([photo("a", "2027-01-12"), photo("b", "2027-01-12"), photo("c", "2027-01-13")]);
    expect(sections.map((s) => [s.day, s.photos.map((p) => p.id)])).toEqual([
      ["2027-01-12", ["a", "b"]],
      ["2027-01-13", ["c"]],
    ]);
    expect(sections[0]!.title).toBe("Martes 12 de enero");
  });

  it("filters by author, and null means everyone", () => {
    const photos = [photo("a", "d", "m1"), photo("b", "d", "m2")];
    expect(filterByAuthor(photos, "m2").map((p) => p.id)).toEqual(["b"]);
    expect(filterByAuthor(photos, null)).toBe(photos);
  });

  it("lists each author once", () => {
    expect(authorsOf([photo("a", "d", "m1"), photo("b", "d", "m2"), photo("c", "d", "m1")]).map((a) => a.id)).toEqual(["m1", "m2"]);
  });

  it("splits photos into rows of three", () => {
    const rows = chunkRows([1, 2, 3, 4, 5, 6, 7], 3);
    expect(rows).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });
});
