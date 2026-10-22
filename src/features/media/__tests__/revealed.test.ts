import type { Schemas } from "@/api/client";
import { mediaSource, toRevealedPhotos } from "../revealed";

type FeedItem = Schemas["FeedItem"];

const item = (overrides: Partial<FeedItem> = {}): FeedItem => ({
  id: "a",
  type: "photo",
  takenAt: 2000,
  day: "2027-01-12",
  lat: -49.3,
  lng: -72.9,
  caption: null,
  durationS: null,
  thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
  author: { id: "m1", userId: "u-m1", name: "Cami", username: null, avatarUrl: null },
  width: 4000,
  height: 3000,
  files: { thumb: "/trips/t/media/a/thumb", original: "/trips/t/media/a/original" },
  ...overrides,
});

describe("revealed photos", () => {
  it("keeps only items with files, ordered by when they were taken", () => {
    const photos = toRevealedPhotos([
      item({ id: "late", takenAt: 3000 }),
      item({ id: "hidden", files: undefined }),
      item({ id: "early", takenAt: 1000 }),
    ]);

    expect(photos.map((p) => p.id)).toEqual(["early", "late"]);
  });

  it("exposes the download paths of each photo", () => {
    const [photo] = toRevealedPhotos([item()]);

    expect(photo).toMatchObject({ thumbPath: "/trips/t/media/a/thumb", originalPath: "/trips/t/media/a/original" });
  });

  it("carries whether I featured it, whether its author blocks featuring, and the author's user id", () => {
    const [photo] = toRevealedPhotos([item({ featuredByMe: true, featureBlocked: true })]);

    expect(photo).toMatchObject({ featuredByMe: true, featureBlocked: true, authorUserId: "u-m1" });
  });

  it("defaults the featuring flags to false when the server leaves them out", () => {
    const [photo] = toRevealedPhotos([item()]);

    expect(photo).toMatchObject({ featuredByMe: false, featureBlocked: false });
  });
});

describe("media source", () => {
  it("points to the API with the trip token", () => {
    expect(mediaSource("/trips/t/media/a/thumb", "secret", "http://api")).toEqual({
      uri: "http://api/trips/t/media/a/thumb",
      headers: { Authorization: "Bearer secret" },
    });
  });
});
