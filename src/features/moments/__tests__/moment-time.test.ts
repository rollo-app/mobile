import { formatLeft, momentState } from "../moment-time";

describe("momentState", () => {
  const at = Date.UTC(2027, 0, 5, 15);

  it("is open with the time left while inside the window", () => {
    expect(momentState(at, at + 299_000)).toEqual({ kind: "open", leftMs: 1_000 });
    expect(momentState(at, at)).toEqual({ kind: "open", leftMs: 300_000 });
  });

  it("is open right at the end of the window and late after it", () => {
    expect(momentState(at, at + 300_000)).toEqual({ kind: "open", leftMs: 0 });
    expect(momentState(at, at + 300_001)).toEqual({ kind: "late" });
  });
});

describe("formatLeft", () => {
  it("formats minutes and padded seconds", () => {
    expect(formatLeft(192_000)).toBe("3:12");
    expect(formatLeft(300_000)).toBe("5:00");
    expect(formatLeft(61_000)).toBe("1:01");
  });

  it("rounds up partial seconds and never goes negative", () => {
    expect(formatLeft(1)).toBe("0:01");
    expect(formatLeft(-5)).toBe("0:00");
  });
});
