import { useLocalSearchParams } from "expo-router";
import { PhotoViewer } from "@/features/gallery/photo-viewer";

export default function PhotoRoute() {
  const { id, tripId } = useLocalSearchParams<{ id: string; tripId?: string }>();
  return <PhotoViewer id={id} tripId={tripId} />;
}
