import { applyFilterAction, buildFilterActions } from "../filter-menu";

const members = [
  { id: "u1", name: "Cami" },
  { id: "u2", name: "Lu" },
];
const base = { hasToday: true, hasMoments: true, today: false, momentsOnly: false, authorId: null, members };

describe("buildFilterActions", () => {
  it("offers today, moments and people in that order", () => {
    expect(buildFilterActions(base).map((a) => a.id)).toEqual(["today", "moments", "people"]);
  });

  it("leaves out today once the roll has ended", () => {
    expect(buildFilterActions({ ...base, hasToday: false }).map((a) => a.id)).toEqual(["moments", "people"]);
  });

  it("leaves out moments until the roll has any", () => {
    expect(buildFilterActions({ ...base, hasMoments: false }).map((a) => a.id)).toEqual(["today", "people"]);
  });

  it("marks the active toggles as on", () => {
    const [today, moments] = buildFilterActions({ ...base, today: true, momentsOnly: true });
    expect(today?.state).toBe("on");
    expect(moments?.state).toBe("on");
  });

  it("lists everybody and marks Todos when no person is picked", () => {
    const people = buildFilterActions(base).find((a) => a.id === "people")!;
    expect(people.displayInline).toBe(true);
    expect(people.subactions?.map((s) => [s.id, s.title, s.state])).toEqual([
      ["all", "Todos", "on"],
      ["u1", "Cami", "off"],
      ["u2", "Lu", "off"],
    ]);
  });

  it("marks the picked person", () => {
    const people = buildFilterActions({ ...base, authorId: "u2" }).find((a) => a.id === "people")!;
    expect(people.subactions?.map((s) => s.state)).toEqual(["off", "off", "on"]);
  });
});

describe("applyFilterAction", () => {
  const state = { today: false, moments: false, authorId: null };

  it("toggles today", () => {
    expect(applyFilterAction(state, "today")).toEqual({ ...state, today: true });
    expect(applyFilterAction({ ...state, today: true }, "today").today).toBe(false);
  });

  it("toggles moments", () => {
    expect(applyFilterAction(state, "moments")).toEqual({ ...state, moments: true });
  });

  it("picks a person and clears with Todos", () => {
    const picked = applyFilterAction(state, "u1");
    expect(picked.authorId).toBe("u1");
    expect(applyFilterAction(picked, "all").authorId).toBeNull();
  });
});
