import { searchText } from "@/features/friends/search-text";
import type { TripDetail } from "@/features/trips/actions";

type Member = TripDetail["me"];

/** How many members "En el rollo" shows before "Ver todos". */
export const PREVIEW_COUNT = 10;

/** Creator first, then the other admins, then you, then everyone else; each group keeps the server's order. */
export function orderMembers(members: Member[], meId: string): Member[] {
  const rank = (m: Member) => (m.isCreator ? 0 : m.role === "admin" ? 1 : m.id === meId ? 2 : 3);
  return members
    .map((m, i) => ({ m, i }))
    .sort((a, b) => rank(a.m) - rank(b.m) || a.i - b.i)
    .map(({ m }) => m);
}

/** The first `n` members in display order, with the real total and whether some are left out. */
export function previewMembers(members: Member[], meId: string, n = PREVIEW_COUNT) {
  const ordered = orderMembers(members, meId);
  return { shown: ordered.slice(0, n), total: ordered.length, hasMore: ordered.length > n };
}

/** Members whose name or @username contains the query, without accents or case; an empty query keeps all. */
export function filterMembers(members: Member[], query: string): Member[] {
  const q = searchText(query.trim().replace(/^@+/, ""));
  if (!q) return members;
  return members.filter((m) => searchText(m.name).includes(q) || searchText(m.username ?? "").includes(q));
}
