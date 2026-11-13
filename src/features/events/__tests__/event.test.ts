import type { TripDetail } from "@/features/trips/actions";
import { isEvent, isOrganizer, myGroups, photoGroupLabel, sendableGroups } from "../event";

const GROUPS = [
  { id: "g1", name: "Novios" },
  { id: "g2", name: "Familia" },
  { id: "g3", name: "Amigos" },
];

const detail = (role: "admin" | "member", groupIds: string[]) =>
  ({ trip: { type: "event", groups: GROUPS }, me: { role, groupIds } }) as unknown as TripDetail;

describe("isEvent", () => {
  it("is true for an event and false for a regular trip", () => {
    expect(isEvent({ type: "event" })).toBe(true);
    expect(isEvent({ type: "trip" })).toBe(false);
  });
});

describe("isOrganizer", () => {
  it("is true for an admin and false for a member", () => {
    expect(isOrganizer(detail("admin", []))).toBe(true);
    expect(isOrganizer(detail("member", ["g1"]))).toBe(false);
  });
});

describe("myGroups", () => {
  it("returns the groups the member is in, in the event's order", () => {
    expect(myGroups(detail("member", ["g3", "g1"]))).toEqual([GROUPS[0], GROUPS[2]]);
  });

  it("is empty for an organizer without groups", () => {
    expect(myGroups(detail("admin", []))).toEqual([]);
  });

  it("ignores ids of groups that no longer exist", () => {
    expect(myGroups(detail("member", ["g2", "gone"]))).toEqual([GROUPS[1]]);
  });
});

describe("sendableGroups", () => {
  it("gives an organizer every group", () => {
    expect(sendableGroups(detail("admin", []))).toEqual(GROUPS);
  });

  it("gives a guest only their own groups", () => {
    expect(sendableGroups(detail("member", ["g2"]))).toEqual([GROUPS[1]]);
  });
});

describe("legacy cached objects (saved by 1.3, without the event fields)", () => {
  const legacy = { trip: {}, me: { role: "member" } } as unknown as TripDetail;
  const legacyAdmin = { trip: {}, me: { role: "admin" } } as unknown as TripDetail;

  it("treats a trip without type as a regular trip", () => {
    expect(isEvent({} as never)).toBe(false);
  });

  it("defaults missing groups and groupIds to empty lists", () => {
    expect(myGroups(legacy)).toEqual([]);
    expect(sendableGroups(legacy)).toEqual([]);
    expect(sendableGroups(legacyAdmin)).toEqual([]);
    expect(isOrganizer(legacyAdmin)).toBe(true);
  });
});

describe("photoGroupLabel", () => {
  it("names the photo's groups for an organizer, in the event's order", () => {
    expect(photoGroupLabel(detail("admin", []), ["g3", "g1"])).toBe("Novios, Amigos");
  });

  it("says Todos los grupos when an organizer's photo went to every group", () => {
    expect(photoGroupLabel(detail("admin", []), ["g2", "g1", "g3"])).toBe("Todos los grupos");
  });

  it("names only the guest's own groups for a guest in several", () => {
    expect(photoGroupLabel(detail("member", ["g1", "g2"]), ["g2", "g3"])).toBe("Familia");
    expect(photoGroupLabel(detail("member", ["g1", "g2"]), ["g1", "g2"])).toBe("Novios, Familia");
  });

  it("is null for a guest in a single group: every photo they see is from it", () => {
    expect(photoGroupLabel(detail("member", ["g1"]), ["g1", "g2"])).toBeNull();
  });

  it("is null in a regular trip and without known groups", () => {
    const trip = { trip: { type: "trip", groups: [] }, me: { role: "admin", groupIds: [] } } as unknown as TripDetail;
    expect(photoGroupLabel(trip, [])).toBeNull();
    expect(photoGroupLabel(detail("admin", []), [])).toBeNull();
    expect(photoGroupLabel(detail("admin", []), ["gone"])).toBeNull();
    expect(photoGroupLabel(detail("admin", []), undefined)).toBeNull();
  });
});
