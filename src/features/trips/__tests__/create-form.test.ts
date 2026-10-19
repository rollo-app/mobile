import { defaultStart, validateRoll } from "../create-form";

const HOUR = 60 * 60 * 1000;
const T = Date.UTC(2027, 0, 5, 12, 0);

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
    expect(validateRoll(ok)).toEqual({ valid: true });
  });

  it("requires both names", () => {
    expect(validateRoll({ ...ok, name: "  " }).valid).toBe(false);
    expect(validateRoll({ ...ok, adminName: "" }).valid).toBe(false);
  });

  it("requires the end to be after the start", () => {
    const result = validateRoll({ ...ok, endsAt: ok.startsAt, revealAt: ok.startsAt });
    expect(result.valid).toBe(false);
    expect(result.endError).toBe("El fin tiene que ser después del inicio");
  });

  it("allows the reveal at the same moment as the end", () => {
    expect(validateRoll({ ...ok, revealAt: ok.endsAt }).valid).toBe(true);
  });

  it("rejects a reveal before the end", () => {
    const result = validateRoll({ ...ok, revealAt: ok.endsAt - 1 });
    expect(result.valid).toBe(false);
    expect(result.revealError).toBe("El revelado no puede ser antes del fin");
  });
});
