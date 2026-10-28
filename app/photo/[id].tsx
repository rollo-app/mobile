import { useLocalSearchParams } from "expo-router";
import { PhotoViewer } from "@/features/gallery/photo-viewer";

export default function PhotoRoute() {
  const { id, tripId, comments } = useLocalSearchParams<{ id: string; tripId?: string; comments?: string }>();
  return <PhotoViewer id={id} tripId={tripId} openComments={comments === "1"} />;
}
