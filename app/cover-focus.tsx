import { useLocalSearchParams } from "expo-router";
import { CoverFocusScreen } from "@/features/trips/cover-focus-screen";

/** "Qué se ve en la lista": modal to pick the part of a rollo's cover the Rollos list shows. */
export default function CoverFocusRoute() {
  const { tripId, uri } = useLocalSearchParams<{ tripId: string; uri?: string }>();
  return <CoverFocusScreen tripId={tripId} uri={uri} />;
}
