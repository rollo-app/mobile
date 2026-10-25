import { currentMoment } from "../current-moment";

const NOW = Date.UTC(2027, 0, 12, 15, 0, 0);
const delivered = (tripId: string, day: string, at: number, identifier = `moment.${tripId}.${day}`) => ({
  identifier,
  data: { url: `/moment?trip=${tripId}&day=${day}&at=${at}` } as Record<string, unknown>,
});

describe("currentMoment", () => {
  it("returns the moment delivered 2 minutes ago, with the time left", () => {
    expect(currentMoment([delivered("t1", "2027-01-12", NOW - 120_000)], NOW)).toEqual({
      tripId: "t1",
      day: "2027-01-12",
      at: NOW - 120_000,
      leftMs: 180_000,
    });
  });

  it("returns null for one delivered 6 minutes ago", () => {
    expect(currentMoment([delivered("t1", "2027-01-12", NOW - 360_000)], NOW)).toBeNull();
  });

  it("ignores notifications that are not moments", () => {
    expect(currentMoment([{ identifier: "push-1", data: { url: "/roll?trip=t1" } }], NOW)).toBeNull();
    expect(currentMoment([], NOW)).toBeNull();
  });

  it("ignores a moment notification without a usable at", () => {
    expect(currentMoment([{ identifier: "moment.t1.2027-01-12", data: { url: "/moment?trip=t1&day=2027-01-12" } }], NOW)).toBeNull();
    expect(currentMoment([{ identifier: "moment.t1.2027-01-12", data: {} }], NOW)).toBeNull();
  });

  it("with several open, picks the most recent one", () => {
    const older = delivered("t1", "2027-01-12", NOW - 200_000);
    const newer = delivered("t2", "2027-01-12", NOW - 10_000);
    expect(currentMoment([older, newer], NOW)?.tripId).toBe("t2");
  });
});
