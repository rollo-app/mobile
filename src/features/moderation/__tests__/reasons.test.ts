import { REPORT_REASONS, reasonAt } from "../reasons";

describe("REPORT_REASONS", () => {
  it("lists the reasons with their labels, in order", () => {
    expect(REPORT_REASONS).toEqual([
      { reason: "offensive", label: "Es ofensivo" },
      { reason: "abuse", label: "Es acoso o abuso" },
      { reason: "other", label: "Otro motivo" },
    ]);
  });
});

describe("reasonAt", () => {
  it("maps action sheet indexes to reasons", () => {
    expect(reasonAt(0)).toBe("offensive");
    expect(reasonAt(1)).toBe("abuse");
    expect(reasonAt(2)).toBe("other");
  });

  it("returns null for the cancel button and out of range", () => {
    expect(reasonAt(3)).toBeNull();
    expect(reasonAt(-1)).toBeNull();
  });
});
