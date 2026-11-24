import type { RevealedPhoto } from "@/features/media/revealed";
import { buildChapters, SPLIT_THRESHOLD, timeBlockTitle } from "../chapters";

const photo = (id: string, day: string, takenAt = 0, groupIds: string[] = []): RevealedPhoto => ({
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
  author: { id: "m1", userId: "u-m1", name: "m1", username: null, avatarUrl: null },
  thumbPath: `/t/${id}`,
  originalPath: `/o/${id}`,
  displayPath: `/o/${id}`,
  originalAvailable: true,
  authorUserId: "u-m1",
  featuredByMe: false,
  featureBlocked: false,
  likeCount: 0,
  canFeature: true,
  likedByMe: false,
  commentCount: 0,
  momentDay: null,
  archived: false,
  selfie: null,
  groupIds,
});

const ZONE = "America/Argentina/Buenos_Aires";
// 2027-01-09 (Saturday) 20:10 and 22:30 in Buenos Aires (UTC-3).
const AT_2010 = Date.UTC(2027, 0, 9, 23, 10);
const AT_2230 = Date.UTC(2027, 0, 10, 1, 30);
const groups = [
  { id: "A", name: "Familia" },
  { id: "B", name: "Amigos" },
];

describe("buildChapters", () => {
  it("numbers trip days from the trip start, skipping empty days", () => {
    const chapters = buildChapters([photo("a", "2027-01-03"), photo("b", "2027-01-05")], {
      kind: "trip",
      startDay: "2027-01-03",
    });
    expect(chapters.map((c) => c.kicker)).toEqual(["DÍA 1", "DÍA 3"]);
    expect(chapters.map((c) => c.key)).toEqual(["trip:2027-01-03", "trip:2027-01-05"]);
    expect(chapters.every((c) => c.placeable)).toBe(true);
  });

  it("puts an event photo only in its first group by event order", () => {
    const chapters = buildChapters([photo("a", "2027-01-09", AT_2010, ["B", "A"])], {
      kind: "event",
      groups,
      showGroupTitle: true,
      timeZone: ZONE,
      multiDay: false,
    });
    expect(chapters).toHaveLength(1);
    expect(chapters[0]!.key).toBe("group:A");
    expect(chapters[0]!.placeable).toBe(false);
  });

  it("collects photos without a visible group in Otras fotos", () => {
    const input = [photo("a", "2027-01-09", AT_2010, ["A"]), photo("b", "2027-01-09", AT_2010, [])];
    const chapters = buildChapters(input, { kind: "event", groups, showGroupTitle: true, timeZone: ZONE, multiDay: false });
    const last = chapters[chapters.length - 1]!;
    expect(last.title).toBe("Otras fotos");
    expect(last.key).toBe("others");
    expect(last.kicker).toBeNull();
    expect(chapters.reduce((n, c) => n + c.photos.length, 0)).toBe(input.length);
  });

  it("splits a group over 40 photos into 2-hour blocks", () => {
    const input = Array.from({ length: SPLIT_THRESHOLD + 1 }, (_, i) =>
      photo(`p${i}`, "2027-01-09", i < 30 ? AT_2010 : AT_2230, ["A"]),
    );
    const chapters = buildChapters(input, { kind: "event", groups, showGroupTitle: true, timeZone: ZONE, multiDay: false });
    expect(chapters.map((c) => c.title)).toEqual(["De 20 a 22 h", "De 22 a 0 h"]);
    expect(chapters.every((c) => c.kicker === "FAMILIA")).toBe(true);
    expect(chapters.map((c) => c.key)).toEqual(["group:A:2027-01-09:20", "group:A:2027-01-09:22"]);
  });

  it("keeps a group of 40 as one chapter", () => {
    const input = Array.from({ length: SPLIT_THRESHOLD }, (_, i) => photo(`p${i}`, "2027-01-09", AT_2010, ["A"]));
    const chapters = buildChapters(input, { kind: "event", groups, showGroupTitle: true, timeZone: ZONE, multiDay: false });
    expect(chapters).toHaveLength(1);
    expect(chapters[0]).toMatchObject({ kicker: "GRUPO", title: "Familia" });
  });

  it("hides the group title for a single-group guest", () => {
    const chapters = buildChapters([photo("a", "2027-01-09", AT_2010, ["A"])], {
      kind: "event",
      groups: [groups[0]!],
      showGroupTitle: false,
      timeZone: ZONE,
      multiDay: false,
    });
    expect(chapters[0]).toMatchObject({ kicker: null, title: "Sábado 9 de enero" });
  });
});

describe("timeBlockTitle", () => {
  it("formats the block range", () => {
    expect(timeBlockTitle(AT_2010, ZONE, false)).toBe("De 20 a 22 h");
    expect(timeBlockTitle(AT_2230, ZONE, false)).toBe("De 22 a 0 h");
  });

  it("prefixes the weekday when asked", () => {
    expect(timeBlockTitle(AT_2010, ZONE, true)).toBe("Sábado · de 20 a 22 h");
  });
});
