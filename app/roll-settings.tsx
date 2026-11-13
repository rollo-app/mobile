import { useLocalSearchParams } from "expo-router";
import { RollSettingsScreen } from "@/features/roll/roll-settings-screen";

/** "Ajustes del rollo": the gear in the Rollo tab's header. */
export default function RollSettingsRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return <RollSettingsScreen tripId={tripId} />;
}
