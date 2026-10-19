import { formatDate, formatTime, nextPhaseEdge, rollPhase, startsIn } from "../phase";

const TZ = "America/Argentina/Buenos_Aires";
const HOUR = 60 * 60 * 1000;
const trip = (o: { startsAt?: number; endsAt?: number; revealed?: boolean } = {}) => ({
  startsAt: 1000,
  endsAt: 2000,
  revealed: false,
  timezone: TZ,
  ...o,
});

describe("rollPhase", () => {
  it("is upcoming before it starts", () => expect(rollPhase(trip(), 999)).toBe("upcoming"));
  it("is active exactly at the start", () => expect(rollPhase(trip(), 1000)).toBe("active"));
  it("is active just before the end", () => expect(rollPhase(trip(), 1999)).toBe("active"));
  it("is ended exactly at the end", () => expect(rollPhase(trip(), 2000)).toBe("ended"));
  it("stays ended long after, while not revealed", () => expect(rollPhase(trip(), 9e9)).toBe("ended"));
  it("is revealed whenever the server says so", () => {
    expect(rollPhase(trip({ revealed: true }), 500)).toBe("revealed");
    expect(rollPhase(trip({ revealed: true }), 1500)).toBe("revealed");
    expect(rollPhase(trip({ revealed: true }), 3000)).toBe("revealed");
  });
});

describe("nextPhaseEdge", () => {
  it("is the start while upcoming", () => expect(nextPhaseEdge(trip(), 10)).toBe(1000));
  it("is the end while active", () => expect(nextPhaseEdge(trip(), 1000)).toBe(2000));
  it("is null once ended or revealed", () => {
    expect(nextPhaseEdge(trip(), 2000)).toBeNull();
    expect(nextPhaseEdge(trip({ revealed: true }), 10)).toBeNull();
  });
});

describe("formatting in the trip's zone", () => {
  const at = Date.UTC(2026, 9, 29, 22, 0); // 19:00 in Buenos Aires
  it("formats date and time", () => {
    expect(formatDate(at, TZ)).toBe("29 de octubre");
    expect(formatTime(at, TZ)).toBe("19:00");
  });
  it("says how far the start is, by calendar day in the trip's zone", () => {
    expect(startsIn(at, at - 3 * HOUR, TZ)).toBe("hoy a las 19:00");
    expect(startsIn(at, at - 24 * HOUR, TZ)).toBe("mañana");
    expect(startsIn(at, at - 5 * 24 * HOUR, TZ)).toBe("en 5 días");
  });
});
