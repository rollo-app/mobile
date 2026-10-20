import { pickActiveTrip, type TripSummary } from "../active";

const trip = (id: string): TripSummary => ({
  id,
  name: id,
  joinCode: "ABC234",
  startsAt: 0,
  endsAt: 1,
  revealAt: 1,
  revealed: false,
  role: "member",
  totalUploaded: 0,
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

  it("is null without trips", () => {
    expect(pickActiveTrip([], "a")).toBeNull();
  });
});
