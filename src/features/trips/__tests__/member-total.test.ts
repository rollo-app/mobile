import { memberTotal } from "../member-total";

const members = [{}, {}] as never[];

describe("memberTotal", () => {
  it("uses the server's total when present", () => {
    expect(memberTotal({ members, memberCount: 87 })).toBe(87);
  });

  it("falls back to the members list when the field is missing (older API or cached detail)", () => {
    expect(memberTotal({ members })).toBe(2);
  });
});
