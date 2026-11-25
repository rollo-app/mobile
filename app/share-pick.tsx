import { useLocalSearchParams } from "expo-router";
import { SharePickScreen } from "@/features/share/share-pick-screen";

/** "Elegir fotos": choose and order the photos of the Stories collage. */
export default function SharePickRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return <SharePickScreen tripId={tripId} />;
}
