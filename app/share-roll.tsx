import { useLocalSearchParams } from "expo-router";
import { ShareRollScreen } from "@/features/share/share-roll-screen";

/** "Compartir" (form sheet): copy the link, WhatsApp or Instagram. */
export default function ShareRollRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return <ShareRollScreen tripId={tripId} />;
}
