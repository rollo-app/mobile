import { router } from "expo-router";
import type { TripDetail } from "@/features/trips/actions";
import { Row, Section } from "@/ui/components";
import { isOrganizer, myGroups } from "./event";

/**
 * "Grupos" in an event's board: organizers see all the groups and manage them; guests see their own and can join others.
 * Managing and joining are closed after the reveal (the server refuses anyway).
 */
export function EventGroupsSection({ detail }: { detail: TripDetail }) {
  const organizer = isOrganizer(detail);
  const groups = organizer ? detail.trip.groups : myGroups(detail);
  const open = !detail.trip.revealed;
  const params = { tripId: detail.trip.id };
  if (groups.length === 0 && !open) return null;
  return (
    <Section title="Grupos">
      {groups.map((g) => (
        <Row key={g.id} label={g.name} />
      ))}
      {open && organizer && <Row label="Administrar grupos" onPress={() => router.push({ pathname: "/event-groups", params })} />}
      {open && !organizer && <Row label="Sumarme a otro grupo" onPress={() => router.push({ pathname: "/my-groups", params })} />}
    </Section>
  );
}
