import { useLocalSearchParams } from "expo-router";
import { CommentsScreen } from "@/features/comments/comments-screen";

/** The comments of a photo (sheet over the viewer). */
export default function CommentsRoute() {
  const { mediaId } = useLocalSearchParams<{ mediaId: string }>();
  return <CommentsScreen mediaId={mediaId} />;
}
