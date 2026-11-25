import type { TripMember } from "@/features/trips/actions";
import { peopleOrder } from "../people-order";

const member = (id: string, extra: Partial<TripMember> = {}): TripMember => ({
  id,
  userId: `u-${id}`,
  name: `Name ${id}`,
  username: null,
  avatarUrl: null,
  role: "member",
  isCreator: false,
  blockedByMe: false,
  ...extra,
});

describe("peopleOrder", () => {
  it("follows the members order", () => {
    const members = [member("a"), member("me"), member("c", { role: "admin" }), member("d", { isCreator: true, role: "admin" })];
    expect(peopleOrder(members, "me", []).map((p) => p.id)).toEqual(["d", "c", "me", "a"]);
  });

  it("adds authors who left at the end", () => {
    const members = [member("a"), member("b")];
    const authors = [
      { id: "z", name: "Zoe" },
      { id: "a", name: "Name a" },
    ];
    expect(peopleOrder(members, "a", authors)).toEqual([
      { id: "a", name: "Name a", avatarUrl: null },
      { id: "b", name: "Name b", avatarUrl: null },
      { id: "z", name: "Zoe", avatarUrl: null },
    ]);
  });

  it("never repeats a person", () => {
    const authors = [
      { id: "z", name: "Zoe" },
      { id: "z", name: "Zoe" },
      { id: "a", name: "Name a" },
    ];
    const ids = peopleOrder([member("a")], "a", authors).map((p) => p.id);
    expect(ids).toEqual(["a", "z"]);
  });
});
