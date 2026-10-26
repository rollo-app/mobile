import { formatLeft, momentState } from "../moment-time";
import { MOMENT_WINDOW_MS } from "../plan";

describe("momentState", () => {
  const at = Date.UTC(2027, 0, 5, 15);

  it("is open with the time left while inside the window", () => {
    expect(momentState(at, at + MOMENT_WINDOW_MS - 1_000)).toEqual({ kind: "open", leftMs: 1_000 });
    expect(momentState(at, at)).toEqual({ kind: "open", leftMs: MOMENT_WINDOW_MS });
  });

  it("is open right at the end of the window and late after it", () => {
    expect(momentState(at, at + MOMENT_WINDOW_MS)).toEqual({ kind: "open", leftMs: 0 });
    expect(momentState(at, at + MOMENT_WINDOW_MS + 1)).toEqual({ kind: "late" });
  });
});

describe("formatLeft", () => {
  it("formats minutes and padded seconds", () => {
    expect(formatLeft(192_000)).toBe("3:12");
    expect(formatLeft(900_000)).toBe("15:00");
    expect(formatLeft(61_000)).toBe("1:01");
  });

  it("rounds up partial seconds and never goes negative", () => {
    expect(formatLeft(1)).toBe("0:01");
    expect(formatLeft(-5)).toBe("0:00");
  });
});
