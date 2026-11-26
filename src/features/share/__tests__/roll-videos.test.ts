import type { RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";
import { bannerPhoto, rollHasPoster, rollVideos } from "../roll-videos";

const detail = (o: { revealed?: boolean; featuringDisabled?: boolean; type?: "trip" | "event" } = {}) =>
  ({ trip: { type: o.type ?? "trip", revealed: o.revealed ?? true, featuringDisabled: o.featuringDisabled ?? false } }) as unknown as TripDetail;

const base = { detail: detail(), videoAvailable: true, ready: true, feedFailed: false, poolStops: 3, sheetOffered: 10 };

describe("rollVideos", () => {
  it("offers the route first and then the sheet", () => expect(rollVideos(base)).toEqual(["route", "sheet"]));
  it("offers only the sheet when the photos make no route", () => expect(rollVideos({ ...base, poolStops: 1 })).toEqual(["sheet"]));
  it("offers only the route when there are too few photos for the sheet", () => expect(rollVideos({ ...base, sheetOffered: 5 })).toEqual(["route"]));
  it("offers nothing when neither qualifies", () => expect(rollVideos({ ...base, poolStops: 0, sheetOffered: 2 })).toEqual([]));
  it("offers nothing on a private roll", () => expect(rollVideos({ ...base, detail: detail({ featuringDisabled: true }) })).toEqual([]));
  it("offers nothing on an unrevealed roll", () => expect(rollVideos({ ...base, detail: detail({ revealed: false }) })).toEqual([]));
  it("offers only the sheet on an event", () => expect(rollVideos({ ...base, detail: detail({ type: "event" }) })).toEqual(["sheet"]));
  it("offers nothing in a build without the video module", () => expect(rollVideos({ ...base, videoAvailable: false })).toEqual([]));
  it("offers nothing until the whole feed is in", () => expect(rollVideos({ ...base, ready: false })).toEqual([]));
  it("offers nothing when the feed failed", () => expect(rollVideos({ ...base, feedFailed: true })).toEqual([]));
  it("offers nothing without the roll's detail", () => expect(rollVideos({ ...base, detail: null })).toEqual([]));
});

const photo = (id: string, o: Partial<RevealedPhoto> = {}) => ({ id, type: "photo", archived: false, likeCount: 0, ...o }) as unknown as RevealedPhoto;

describe("bannerPhoto", () => {
  it("is the most liked live photo", () => expect(bannerPhoto([photo("a", { likeCount: 1 }), photo("b", { likeCount: 4 }), photo("c", { likeCount: 2 })])?.id).toBe("b"));
  it("skips archived photos and videos", () =>
    expect(bannerPhoto([photo("a", { likeCount: 9, archived: true }), photo("v", { likeCount: 8, type: "video" }), photo("c", { likeCount: 1 })])?.id).toBe("c"));
  it("keeps the earlier photo on a tie", () => expect(bannerPhoto([photo("a", { likeCount: 2 }), photo("b", { likeCount: 2 })])?.id).toBe("a"));
  it("is null without photos", () => expect(bannerPhoto([])).toBeNull());
});

describe("rollHasPoster", () => {
  const poster = { detail: detail(), ready: true, feedFailed: false, poolStops: 2 };
  it("is true for a revealed, non-private trip with two stops", () => expect(rollHasPoster(poster)).toBe(true));
  it("is false for an event", () => expect(rollHasPoster({ ...poster, detail: detail({ type: "event" }) })).toBe(false));
  it("is false for a private roll", () => expect(rollHasPoster({ ...poster, detail: detail({ featuringDisabled: true }) })).toBe(false));
  it("is false for an unrevealed roll", () => expect(rollHasPoster({ ...poster, detail: detail({ revealed: false }) })).toBe(false));
  it("is false with a single stop", () => expect(rollHasPoster({ ...poster, poolStops: 1 })).toBe(false));
  it("is false until the feed is in", () => expect(rollHasPoster({ ...poster, ready: false })).toBe(false));
  it("is false when the feed failed", () => expect(rollHasPoster({ ...poster, feedFailed: true })).toBe(false));
  it("is false without the detail", () => expect(rollHasPoster({ ...poster, detail: null })).toBe(false));
});
