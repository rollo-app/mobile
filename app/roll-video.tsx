import { useLocalSearchParams } from "expo-router";
import { RollVideoScreen } from "@/features/share/roll-video-screen";

/** The roll's video (route or summary) full screen, opened from the gallery's banner. */
export default function RollVideoRoute() {
  const { tripId, kind } = useLocalSearchParams<{ tripId: string; kind: string }>();
  return <RollVideoScreen tripId={tripId} kind={kind} />;
}
