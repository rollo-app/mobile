import type { TripDetail } from "@/features/trips/actions";
import { filterMembers, orderMembers, previewMembers, PREVIEW_COUNT } from "@/features/roll/members-order";

type Member = TripDetail["members"][number];
const m = (id: string, name: string, over: Partial<Member> = {}): Member => ({
  id,
  userId: `u-${id}`,
  name,
  username: name.toLowerCase().replace(/\s/g, "."),
  avatarUrl: null,
  role: "member",
  isCreator: false,
  blockedByMe: false,
  ...over,
});
const ids = (list: Member[]) => list.map((x) => x.id);

describe("orderMembers", () => {
  it("puts the creator first, then the other admins, then you, then the rest in the original order", () => {
    const list = [
      m("a", "Ana"),
      m("b", "Beto", { role: "admin" }),
      m("c", "Caro"),
      m("d", "Dani", { role: "admin", isCreator: true }),
      m("e", "Eli", { role: "admin" }),
    ];
    expect(ids(orderMembers(list, "c"))).toEqual(["d", "b", "e", "c", "a"]);
  });

  it("keeps the original order when nobody is special and you are not in the list", () => {
    const list = [m("a", "Ana"), m("b", "Beto"), m("c", "Caro")];
    expect(ids(orderMembers(list, "zzz"))).toEqual(["a", "b", "c"]);
  });

  it("does not mutate its input and is deterministic", () => {
    const list = [m("a", "Ana"), m("b", "Beto", { role: "admin" })];
    const copy = [...list];
    expect(ids(orderMembers(list, "a"))).toEqual(ids(orderMembers(list, "a")));
    expect(list).toEqual(copy);
  });
});

describe("previewMembers", () => {
  const many = Array.from({ length: 101 }, (_, i) => m(`m${i}`, `Persona ${i}`));

  it("shows the first 10 by default and reports the total", () => {
    expect(PREVIEW_COUNT).toBe(10);
    const p = previewMembers(many, "m50");
    expect(p.shown).toHaveLength(10);
    expect(p.total).toBe(101);
    expect(p.hasMore).toBe(true);
  });

  it("keeps you in the preview even when you are far down", () => {
    expect(ids(previewMembers(many, "m50").shown)).toContain("m50");
  });

  it("shows everyone without a 'more' flag with 10 or fewer", () => {
    const few = many.slice(0, 10);
    const p = previewMembers(few, "m3");
    expect(p.shown).toHaveLength(10);
    expect(p.hasMore).toBe(false);
  });

  it("takes an explicit size", () => {
    expect(previewMembers(many, "m1", 3).shown).toHaveLength(3);
  });
});

describe("filterMembers", () => {
  const list = [m("a", "Ana María", { username: "anam" }), m("b", "José", { username: "jose.g" }), m("c", "Cami", { username: null })];

  it("returns everyone for an empty query", () => {
    expect(filterMembers(list, "  ")).toEqual(list);
  });

  it("matches names without accents or case", () => {
    expect(ids(filterMembers(list, "jose"))).toEqual(["b"]);
    expect(ids(filterMembers(list, "MARIA"))).toEqual(["a"]);
  });

  it("matches the @username, with or without the @", () => {
    expect(ids(filterMembers(list, "@jose.g"))).toEqual(["b"]);
    expect(ids(filterMembers(list, "anam"))).toEqual(["a"]);
  });

  it("returns nothing when nobody matches", () => {
    expect(filterMembers(list, "zzz")).toEqual([]);
  });
});
