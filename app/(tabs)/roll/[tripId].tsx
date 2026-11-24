import { useLocalSearchParams } from "expo-router";
import { RollScreen } from "@/features/roll/roll-screen";

export default function RollRoute() {
  const { tripId, view } = useLocalSearchParams<{ tripId: string; view?: string }>();
  return <RollScreen tripId={tripId} view={view} />;
}
