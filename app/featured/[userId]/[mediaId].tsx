import { useLocalSearchParams } from "expo-router";
import { FeaturedViewer } from "@/features/featured/featured-viewer";

/** Full-screen viewer of someone's featured photos. */
export default function FeaturedRoute() {
  const { userId, mediaId } = useLocalSearchParams<{ userId: string; mediaId: string }>();
  return <FeaturedViewer userId={userId} mediaId={mediaId} />;
}
