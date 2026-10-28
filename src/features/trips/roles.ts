import type { TripDetail } from "./actions";

type Member = TripDetail["me"];

export type MemberAction = "makeAdmin" | "removeAdmin" | "remove";

/** What `me` can do to `target` in the members list; the creator is untouchable and only the creator demotes admins. */
export function memberActions(me: Member, target: Member): MemberAction[] {
  if (me.role !== "admin" || target.id === me.id || target.isCreator) return [];
  if (target.role === "admin") return me.isCreator ? ["removeAdmin", "remove"] : [];
  return ["makeAdmin", "remove"];
}

/** Any admin can rename the rollo. */
export function canRename(me: Member): boolean {
  return me.role === "admin";
}

export function memberBadge(m: Member): "Creador" | "Admin" | null {
  if (m.isCreator) return "Creador";
  return m.role === "admin" ? "Admin" : null;
}
