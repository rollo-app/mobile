import { previewMembers } from "@/features/roll/members-order";
import type { TripMember } from "@/features/trips/actions";

export type Person = { id: string; name: string; avatarUrl: string | null };

/** Members in the roll's display order, then authors who are no longer members; nobody twice. */
export function peopleOrder(members: TripMember[], meId: string, authors: { id: string; name: string }[]): Person[] {
  const people: Person[] = previewMembers(members, meId, Infinity).shown.map((m) => ({
    id: m.id,
    name: m.name,
    avatarUrl: m.avatarUrl,
  }));
  const seen = new Set(people.map((p) => p.id));
  for (const a of authors) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    people.push({ id: a.id, name: a.name, avatarUrl: null });
  }
  return people;
}
