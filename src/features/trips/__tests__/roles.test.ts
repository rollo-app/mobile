import type { TripDetail } from "../actions";
import { canRename, memberActions, memberBadge } from "../roles";

type Member = TripDetail["me"];

const member = (id: string, over: Partial<Member> = {}): Member =>
  ({ id, userId: `u-${id}`, name: id, role: "member", isCreator: false, ...over }) as Member;
const admin = (id: string) => member(id, { role: "admin" });
const creator = (id: string) => member(id, { role: "admin", isCreator: true });

describe("memberActions", () => {
  it("offers nothing to a plain member", () => {
    expect(memberActions(member("a"), member("b"))).toEqual([]);
    expect(memberActions(member("a"), admin("b"))).toEqual([]);
  });

  it("lets an admin promote and remove a plain member", () => {
    expect(memberActions(admin("a"), member("b"))).toEqual(["makeAdmin", "remove"]);
  });

  it("does not let an admin act on another admin", () => {
    expect(memberActions(admin("a"), admin("b"))).toEqual([]);
  });

  it("lets the creator demote and remove an admin", () => {
    expect(memberActions(creator("c"), admin("b"))).toEqual(["removeAdmin", "remove"]);
  });

  it("lets the creator promote and remove a plain member", () => {
    expect(memberActions(creator("c"), member("b"))).toEqual(["makeAdmin", "remove"]);
  });

  it("never offers anything on the creator", () => {
    expect(memberActions(creator("c"), creator("c"))).toEqual([]);
    expect(memberActions(admin("a"), creator("c"))).toEqual([]);
  });

  it("never offers anything on yourself", () => {
    expect(memberActions(admin("a"), admin("a"))).toEqual([]);
    expect(memberActions(member("a"), member("a"))).toEqual([]);
  });
});

describe("canRename", () => {
  it("is true for any admin, creator or not", () => {
    expect(canRename(admin("a"))).toBe(true);
    expect(canRename(creator("c"))).toBe(true);
  });

  it("is false for a plain member", () => {
    expect(canRename(member("a"))).toBe(false);
  });
});

describe("memberBadge", () => {
  it("says Creador for the creator even though the role is admin", () => {
    expect(memberBadge(creator("c"))).toBe("Creador");
  });

  it("says Admin for a non-creator admin", () => {
    expect(memberBadge(admin("a"))).toBe("Admin");
  });

  it("has no badge for a plain member", () => {
    expect(memberBadge(member("a"))).toBeNull();
  });
});
