import { useLocalSearchParams } from "expo-router";
import { PhotoCrop } from "@/features/crop/photo-crop";

/** Crop for an event's cover picked from the library (full-screen modal over black). */
export default function CropCoverScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PhotoCrop requestId={id} />;
}
