import { nextTimer, timerLabel } from "../timer";

describe("timer", () => {
  it("cycles apagado → 3 s → 10 s → apagado", () => {
    expect(nextTimer(0)).toBe(3);
    expect(nextTimer(3)).toBe(10);
    expect(nextTimer(10)).toBe(0);
  });

  it("says what it is set to", () => {
    expect(timerLabel(0)).toBe("Temporizador: apagado");
    expect(timerLabel(3)).toBe("Temporizador: 3 segundos");
    expect(timerLabel(10)).toBe("Temporizador: 10 segundos");
  });
});
