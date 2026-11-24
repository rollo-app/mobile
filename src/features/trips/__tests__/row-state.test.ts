import { liveDayLabel, tripRowState } from "../row-state";
import { tripSummary } from "@/test/account";

const TZ = "America/Argentina/Buenos_Aires";
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-22T12:00:00-03:00");

describe("tripRowState", () => {
  it("is live while the roll is on, with the role as subtitle", () => {
    const trip = tripSummary("t", "Sur", { isCreator: true, startsAt: NOW - DAY, endsAt: NOW + DAY, revealAt: NOW + DAY });
    expect(tripRowState(trip, NOW, TZ)).toEqual({ badge: "live", subtitle: "Lo creaste vos", stateLabel: "en vivo" });
  });

  it("is revealed once the server reveals it, saying when and how many photos", () => {
    const revealAt = Date.parse("2026-11-02T10:00:00-03:00");
    const trip = tripSummary("t", "Bariloche", { startsAt: NOW - 9 * DAY, endsAt: NOW - 2 * DAY, revealAt, revealed: true, totalUploaded: 318, role: "member", isCreator: false });
    expect(tripRowState(trip, NOW, TZ)).toEqual({ badge: "revealed", subtitle: "Se reveló el 2 de nov · 318 fotos", stateLabel: "revelado" });
  });

  it("says '1 foto' for a single photo", () => {
    const revealAt = Date.parse("2026-11-02T10:00:00-03:00");
    const trip = tripSummary("t", "x", { revealAt, revealed: true, totalUploaded: 1 });
    expect(tripRowState(trip, NOW, TZ).subtitle).toBe("Se reveló el 2 de nov · 1 foto");
  });

  it("has no badge and says when it starts before it begins", () => {
    const trip = tripSummary("t", "Tandil", { startsAt: NOW + 3 * DAY, endsAt: NOW + 5 * DAY, revealAt: NOW + 5 * DAY });
    expect(tripRowState(trip, NOW, TZ)).toEqual({ badge: null, subtitle: "Empieza en 3 días", stateLabel: null });
  });

  it("says when it reveals after it ended", () => {
    const trip = tripSummary("t", "Facu", { startsAt: NOW - 5 * DAY, endsAt: NOW - DAY, revealAt: NOW + 2 * DAY });
    expect(tripRowState(trip, NOW, TZ)).toEqual({ badge: null, subtitle: "Se revela en 2 días", stateLabel: null });
  });

  it("says tomorrow / today with the trip's own words", () => {
    const tomorrow = tripSummary("t", "x", { startsAt: NOW + DAY, endsAt: NOW + 2 * DAY, revealAt: NOW + 2 * DAY });
    expect(tripRowState(tomorrow, NOW, TZ).subtitle).toBe("Empieza mañana");
    const late = tripSummary("t", "x", { startsAt: NOW - 3 * DAY, endsAt: NOW - DAY, revealAt: NOW - 1000 });
    expect(tripRowState(late, NOW, TZ).subtitle).toBe("Se revela hoy");
  });

  it("says the code was used for an admin who did not create the roll", () => {
    const trip = tripSummary("t", "Sur", { role: "admin", isCreator: false, startsAt: NOW - DAY, endsAt: NOW + DAY, revealAt: NOW + DAY });
    expect(tripRowState(trip, NOW, TZ).subtitle).toBe("Entraste con un código");
  });
});

describe("liveDayLabel", () => {
  it("day 1 of 1", () => {
    const trip = tripSummary("t", "x", { startsAt: NOW - 3600_000, endsAt: NOW + 3600_000 });
    expect(liveDayLabel(trip, NOW, TZ)).toBe("Día 1 de 1");
  });

  it("day 3 of 6 in the trip zone", () => {
    const trip = tripSummary("t", "x", { startsAt: Date.parse("2026-10-20T09:00:00-03:00"), endsAt: Date.parse("2026-10-25T20:00:00-03:00") });
    expect(liveDayLabel(trip, NOW, TZ)).toBe("Día 3 de 6");
  });
});
