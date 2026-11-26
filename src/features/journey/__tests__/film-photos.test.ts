import type { RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";
import { filmBlocked, filmCandidates, filmPhotos, filmStopCount } from "../film-photos";

const photo = (id: string, over: Partial<RevealedPhoto> = {}): RevealedPhoto =>
  ({
    id,
    type: "photo",
    takenAt: 1_000,
    day: "2027-01-12",
    lat: -34.6,
    lng: -58.4,
    shareable: true,
    archived: false,
    likeCount: 0,
    author: { id: "m1", userId: "u1", name: "Ana", username: null, avatarUrl: null },
    ...over,
  }) as RevealedPhoto;

const detail = (trip: Record<string, unknown> = {}): TripDetail => ({ trip: { type: "trip", featuringDisabled: false, revealed: true, ...trip } }) as unknown as TripDetail;

describe("filmCandidates", () => {
  it("drops videos, archived, non-shareable and photos without coordinates", () => {
    const kept = photo("ok");
    const out = filmCandidates([
      kept,
      photo("video", { type: "video" }),
      photo("archived", { archived: true }),
      photo("private", { shareable: false }),
      photo("nolat", { lat: null }),
      photo("nolng", { lng: null }),
    ]);
    expect(out).toEqual([kept]);
  });
});

describe("filmPhotos", () => {
  const all = [photo("a"), photo("b"), photo("c")];

  it("gives every candidate for an empty or stale selection", () => {
    expect(filmPhotos(all, [])).toEqual(all);
    expect(filmPhotos(all, ["gone"])).toEqual(all);
  });

  it("gives only the chosen ones otherwise", () => {
    expect(filmPhotos(all, ["c", "a", "gone"]).map((p) => p.id)).toEqual(["a", "c"]);
  });
});

describe("filmStopCount", () => {
  it("counts one stop for one place, two for towns 60 km apart, none for nothing", () => {
    expect(filmStopCount([photo("a", { takenAt: 1 }), photo("b", { takenAt: 2 })], "2027-01-12")).toBe(1);
    expect(filmStopCount([photo("a", { takenAt: 1 }), photo("b", { takenAt: 2, lat: -35.2 })], "2027-01-12")).toBe(2);
    expect(filmStopCount([], "2027-01-12")).toBe(0);
  });
});

describe("filmBlocked", () => {
  it("says why a roll has no film", () => {
    expect(filmBlocked(detail({ type: "event" }), 3)).toBe("event");
    expect(filmBlocked(detail({ featuringDisabled: true }), 3)).toBe("private");
    expect(filmBlocked(detail({ revealed: false }), 3)).toBe("unrevealed");
    expect(filmBlocked(detail(), 1)).toBe("no-route");
    expect(filmBlocked(detail(), 2)).toBeNull();
  });
});
