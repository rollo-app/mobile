import { useLocalSearchParams } from "expo-router";
import { PhotoCrop } from "@/features/crop/photo-crop";

/** Crop for a profile photo picked from the library (full-screen modal over black). */
export default function CropAvatarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PhotoCrop requestId={id} />;
}
