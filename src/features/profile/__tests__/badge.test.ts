import { badgeLabel } from "../badge";

describe("badgeLabel", () => {
  it("maps the known badges to their label", () => {
    expect(badgeLabel("founder")).toBe("FOUNDER");
    expect(badgeLabel("first_edition")).toBe("FIRST EDITION");
  });

  it("is null for no badge and for unknown values (forward compatible)", () => {
    expect(badgeLabel(null)).toBeNull();
    expect(badgeLabel(undefined)).toBeNull();
    expect(badgeLabel("legend")).toBeNull();
  });
});
