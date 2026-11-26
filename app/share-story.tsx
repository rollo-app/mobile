import { useLocalSearchParams } from "expo-router";
import { ShareStoryScreen } from "@/features/share/share-story-screen";

/** "Compartir": the collage or the invitation as a Stories image, or the route / summary film as a video, to share. */
export default function ShareStoryRoute() {
  const { tripId, kind } = useLocalSearchParams<{ tripId: string; kind: string }>();
  return <ShareStoryScreen tripId={tripId} kind={kind === "invite" ? "invite" : kind === "journey" ? "journey" : kind === "sheet" ? "sheet" : "collage"} />;
}
