import { defaultStart, fitReveal, moveStart, validateRoll } from "../create-form";

const HOUR = 60 * 60 * 1000;
const T = Date.UTC(2027, 0, 5, 12, 0);

const MIN = 60 * 1000;
const ok = { name: "Sur 2027", adminName: "Juani", startsAt: T, endsAt: T + 72 * HOUR, revealAt: T + 72 * HOUR };

describe("defaultStart", () => {
  it("rounds up to the next full hour", () => {
    expect(defaultStart(T + 20 * 60 * 1000)).toBe(T + HOUR);
  });

  it("moves to the next hour even on the exact hour", () => {
    expect(defaultStart(T)).toBe(T + HOUR);
  });
});

describe("validateRoll", () => {
  it("accepts a complete roll", () => {
    expect(validateRoll(ok, T)).toEqual({ valid: true });
  });

  it("requires both names", () => {
    expect(validateRoll({ ...ok, name: "  " }, T).valid).toBe(false);
    expect(validateRoll({ ...ok, adminName: "" }, T).valid).toBe(false);
  });

  it("requires the end to be after the start", () => {
    const result = validateRoll({ ...ok, endsAt: ok.startsAt, revealAt: ok.startsAt }, T);
    expect(result.valid).toBe(false);
    expect(result.endError).toBe("El fin tiene que ser después del inicio");
  });

  it("allows the reveal at the same moment as the end", () => {
    expect(validateRoll({ ...ok, revealAt: ok.endsAt }, T).valid).toBe(true);
  });

  it("rejects a reveal before the end", () => {
    const result = validateRoll({ ...ok, revealAt: ok.endsAt - 1 }, T);
    expect(result.valid).toBe(false);
    expect(result.revealError).toBe("El revelado no puede ser antes del fin");
  });

  it("rejects a start in the past, with 5 minutes of tolerance", () => {
    const result = validateRoll(ok, T + 5 * MIN + 1);
    expect(result.valid).toBe(false);
    expect(result.startError).toBe("El inicio no puede ser en el pasado");
    expect(validateRoll(ok, T + 5 * MIN).valid).toBe(true);
  });
});

describe("moveStart", () => {
  it("keeps the end when the new start is still before it", () => {
    expect(moveStart({ startsAt: T, endsAt: T + 72 * HOUR }, T + HOUR)).toEqual({ startsAt: T + HOUR, endsAt: T + 72 * HOUR });
  });

  it("moves the end after the new start keeping the duration", () => {
    const start = T + 100 * HOUR;
    expect(moveStart({ startsAt: T, endsAt: T + 72 * HOUR }, start)).toEqual({ startsAt: start, endsAt: start + 72 * HOUR });
  });

  it("falls back to one hour when there was no valid duration", () => {
    expect(moveStart({ startsAt: T, endsAt: T }, T + HOUR)).toEqual({ startsAt: T + HOUR, endsAt: T + 2 * HOUR });
  });
});

describe("fitReveal", () => {
  it("leaves a reveal at or after the end alone", () => {
    expect(fitReveal(T + 5 * HOUR, T + 5 * HOUR)).toEqual({ revealAt: T + 5 * HOUR, moved: false });
  });

  it("moves an earlier reveal to the end and says so", () => {
    expect(fitReveal(T + 4 * HOUR, T + 5 * HOUR)).toEqual({ revealAt: T + 5 * HOUR, moved: true });
  });
});
