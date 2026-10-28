import type { TripSummary } from "../active";
import { groupTrips } from "../group-trips";

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

const trip = (id: string, over: Partial<TripSummary> = {}): TripSummary => ({
  id,
  name: id,
  joinCode: "ABC234",
  startsAt: NOW - 10 * DAY,
  endsAt: NOW - 5 * DAY,
  revealAt: NOW - 4 * DAY,
  revealed: true,
  role: "member",
  totalUploaded: 0,
  momentMode: "off",
  coverThumbhash: null,
  ...over,
});

const ids = (list: TripSummary[]) => list.map((t) => t.id);

describe("groupTrips", () => {
  it("keeps live, upcoming and ended-but-unrevealed rolls on top in their original order", () => {
    const live = trip("live", { revealed: false, startsAt: NOW - DAY, endsAt: NOW + DAY, revealAt: NOW + DAY });
    const upcoming = trip("upcoming", { revealed: false, startsAt: NOW + DAY, endsAt: NOW + 2 * DAY, revealAt: NOW + 2 * DAY });
    const ended = trip("ended", { revealed: false, endsAt: NOW - DAY, revealAt: NOW + DAY });
    const g = groupTrips([upcoming, live, ended], NOW, null);
    expect(ids(g.top)).toEqual(["upcoming", "live", "ended"]);
    expect(g.revealed).toEqual([]);
    expect(g.older).toEqual([]);
  });

  it("puts rolls revealed within 3 months in 'revealed', newest reveal first", () => {
    const a = trip("a", { revealAt: NOW - 30 * DAY });
    const b = trip("b", { revealAt: NOW - 2 * DAY });
    const g = groupTrips([a, b], NOW, null);
    expect(ids(g.revealed)).toEqual(["b", "a"]);
    expect(g.older).toEqual([]);
  });

  it("treats a reveal exactly 3 months ago as recent and one ms earlier as old", () => {
    const edge = Date.UTC(2026, 6, 25, 12, 0, 0);
    const g = groupTrips([trip("edge", { revealAt: edge }), trip("past", { revealAt: edge - 1 })], NOW, null);
    expect(ids(g.revealed)).toEqual(["edge"]);
    expect(ids(g.older)).toEqual(["past"]);
  });

  it("sorts old rolls newest first", () => {
    const g = groupTrips([trip("x", { revealAt: NOW - 200 * DAY }), trip("y", { revealAt: NOW - 100 * DAY })], NOW, null);
    expect(ids(g.older)).toEqual(["y", "x"]);
  });

  it("keeps a roll with no reveal yet out of the revealed groups, however old its dates", () => {
    const g = groupTrips([trip("pending", { revealed: false, startsAt: NOW - 400 * DAY, endsAt: NOW - 390 * DAY, revealAt: NOW - 380 * DAY })], NOW, null);
    expect(ids(g.top)).toEqual(["pending"]);
    expect(g.older).toEqual([]);
  });

  it("expands the old group by default only when the active roll is in it", () => {
    const old = trip("old", { revealAt: NOW - 200 * DAY });
    const recent = trip("recent");
    expect(groupTrips([recent, old], NOW, "old").olderExpandedByDefault).toBe(true);
    expect(groupTrips([recent, old], NOW, "recent").olderExpandedByDefault).toBe(false);
    expect(groupTrips([recent, old], NOW, null).olderExpandedByDefault).toBe(false);
  });
});
