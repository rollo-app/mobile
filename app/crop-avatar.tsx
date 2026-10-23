import { useLocalSearchParams } from "expo-router";
import { AvatarCrop } from "@/features/profile/avatar-crop";

/** Crop for a profile photo picked from the library (full-screen modal over black). */
export default function CropAvatarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AvatarCrop requestId={id} />;
}
