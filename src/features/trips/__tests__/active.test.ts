import { hasNoTrips, pickActiveTrip, type TripSummary } from "../active";

const trip = (id: string): TripSummary => ({
  id,
  name: id,
  joinCode: "ABC234",
  startsAt: 0,
  endsAt: 1,
  revealAt: 1,
  revealed: false,
  role: "member",
  isCreator: false,
  archived: false,
  totalUploaded: 0,
  momentMode: "off",
  coverThumbhash: null,
});

describe("pickActiveTrip", () => {
  const trips = [trip("a"), trip("b"), trip("c")];

  it("is the saved one when it's in the list", () => {
    expect(pickActiveTrip(trips, "b")?.id).toBe("b");
  });

  it("is the first (the most recent) when none is saved", () => {
    expect(pickActiveTrip(trips, null)?.id).toBe("a");
  });

  it("is the first when the saved one is gone", () => {
    expect(pickActiveTrip(trips, "zzz")?.id).toBe("a");
  });

  it("skips archived rollos when falling back", () => {
    const list = [{ ...trip("a"), archived: true }, trip("b")];
    expect(pickActiveTrip(list, null)?.id).toBe("b");
    expect(pickActiveTrip(list, "zzz")?.id).toBe("b");
  });

  it("falls back to the first when all are archived", () => {
    expect(pickActiveTrip([{ ...trip("a"), archived: true }], null)?.id).toBe("a");
  });

  it("keeps an archived saved one", () => {
    expect(pickActiveTrip([{ ...trip("a"), archived: true }, trip("b")], "a")?.id).toBe("a");
  });

  it("is null without trips", () => {
    expect(pickActiveTrip([], "a")).toBeNull();
  });
});

describe("hasNoTrips", () => {
  it("is true only once the list has loaded and no trip came out of it", () => {
    expect(hasNoTrips(true, null)).toBe(true);
    expect(hasNoTrips(false, null)).toBe(false);
    expect(hasNoTrips(true, trip("a"))).toBe(false);
  });
});
