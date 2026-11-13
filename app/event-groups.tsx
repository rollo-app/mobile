import { useLocalSearchParams } from "expo-router";
import { GroupsScreen } from "@/features/events/groups-screen";

/** An event's groups, for organizers (the "Grupos" section of the Rollo tab). */
export default function EventGroupsRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return <GroupsScreen tripId={tripId} />;
}
