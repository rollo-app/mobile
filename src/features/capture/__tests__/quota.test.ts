import { localDay, remaining } from "../quota";

describe("trip local day", () => {
  it("uses the trip's zone, not UTC", () => {
    // 02:00 UTC on the 13th is 23:00 on the 12th in Argentina
    expect(localDay(Date.parse("2027-01-13T02:00:00Z"), "America/Argentina/Buenos_Aires")).toBe("2027-01-12");
  });

  it("returns the date zero-padded", () => {
    expect(localDay(Date.parse("2027-03-05T15:00:00Z"), "America/Argentina/Buenos_Aires")).toBe("2027-03-05");
  });
});

describe("what you have left today", () => {
  const today = { date: "2027-01-12", photosLeft: 7, videosLeft: 2 };

  it("subtracts what was shot but not yet uploaded", () => {
    expect(remaining(today, "2027-01-12", { photos: 3, videos: 2 })).toEqual({ photos: 4, videos: 0 });
  });

  it("is never negative", () => {
    expect(remaining(today, "2027-01-12", { photos: 9, videos: 0 })).toEqual({ photos: 0, videos: 2 });
  });

  it("if the server data is from another day, it does not know how much is left", () => {
    expect(remaining(today, "2027-01-13", { photos: 0, videos: 0 })).toBeNull();
  });

  it("with no server data it does not know either", () => {
    expect(remaining(null, "2027-01-12", { photos: 0, videos: 0 })).toBeNull();
  });
});
