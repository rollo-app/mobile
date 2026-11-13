import { useLocalSearchParams } from "expo-router";
import { MyGroupsScreen } from "@/features/events/my-groups-screen";

/** "Sumarme a otro grupo": the guest's groups in an event. */
export default function MyGroupsRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return <MyGroupsScreen tripId={tripId} />;
}
