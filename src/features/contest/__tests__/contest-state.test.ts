import { canPick, MAX_FINALISTS, pickCountLabel, picksRowVisible } from "../contest-state";

describe("pickCountLabel", () => {
  it("counts the picks over the maximum", () => {
    expect(pickCountLabel(4)).toBe("4 de 10");
    expect(pickCountLabel(0)).toBe("0 de 10");
    expect(MAX_FINALISTS).toBe(10);
  });
});

describe("canPick", () => {
  it("only an organizer while the finalists are being chosen", () => {
    expect(canPick({ status: "selecting" }, true)).toBe(true);
    expect(canPick({ status: "selecting" }, false)).toBe(false);
    for (const status of ["pending", "voting", "closing", "tied", "closed", "cancelled"] as const) {
      expect(canPick({ status }, true)).toBe(false);
    }
  });

  it("not without a contest", () => {
    expect(canPick(null, true)).toBe(false);
    expect(canPick(undefined, true)).toBe(false);
  });
});

describe("picksRowVisible", () => {
  const on = { organizer: true, contestEnabled: true, phase: "ended" as const };
  it("shows for an organizer of an event with a contest, ended and not revealed", () => {
    expect(picksRowVisible(on)).toBe(true);
  });
  it("hides for guests, without contest and in any other phase", () => {
    expect(picksRowVisible({ ...on, organizer: false })).toBe(false);
    expect(picksRowVisible({ ...on, contestEnabled: false })).toBe(false);
    expect(picksRowVisible({ ...on, phase: "active" })).toBe(false);
    expect(picksRowVisible({ ...on, phase: "upcoming" })).toBe(false);
    expect(picksRowVisible({ ...on, phase: "revealed" })).toBe(false);
    expect(picksRowVisible({ ...on, phase: null })).toBe(false);
  });
});
