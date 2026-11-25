import type * as Location from "expo-location";
import type { RevealedPhoto } from "@/features/media/revealed";
import { chapterCenter, placeKey, placeName } from "../place";

const photo = (id: string, lat: number | null, lng: number | null): RevealedPhoto => ({
  id,
  type: "photo",
  takenAt: 0,
  day: "2027-01-09",
  lat,
  lng,
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
  shareable: false,
  featureBlocked: false,
  likeCount: 0,
  canFeature: true,
  likedByMe: false,
  commentCount: 0,
  momentDay: null,
  archived: false,
  selfie: null,
  groupIds: [],
});

const ZONE = "America/Argentina/Buenos_Aires";

describe("chapterCenter", () => {
  it("ignores photos without GPS", () => {
    expect(chapterCenter([photo("a", null, null), photo("b", 10, 20)])).toEqual({ lat: 10, lng: 20 });
  });

  it("null without any GPS", () => {
    expect(chapterCenter([photo("a", null, null)])).toBeNull();
    expect(chapterCenter([])).toBeNull();
  });

  it("uses the median", () => {
    const photos = [photo("a", 10, 20), photo("b", 11, 21), photo("c", 80, -150)];
    expect(chapterCenter(photos)).toEqual({ lat: 11, lng: 20 });
  });
});

describe("placeKey", () => {
  it("rounds to 2 decimals", () => {
    expect(placeKey({ lat: -41.1349, lng: -71.3051 })).toBe("-41.13,-71.31");
  });
});

describe("placeName", () => {
  const addr = (a: Partial<Location.LocationGeocodedAddress>) => a as Location.LocationGeocodedAddress;
  it("prefers the city, then subregion, then region", () => {
    expect(placeName(addr({ city: "Bariloche", subregion: "S", region: "R" }))).toBe("Bariloche");
    expect(placeName(addr({ city: null, subregion: "S", region: "R" }))).toBe("S");
    expect(placeName(addr({ city: null, subregion: null, region: "R" }))).toBe("R");
  });
  it("null when there is nothing", () => {
    expect(placeName(addr({ city: null, subregion: null, region: null }))).toBeNull();
  });
});
