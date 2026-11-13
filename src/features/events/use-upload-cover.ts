import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { errorMessage } from "@/api/client";
import { openCropRequest } from "@/features/crop/crop-request";
import { uploadCover } from "@/features/trips/actions";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { tripKey } from "@/features/trips/use-trip-detail";

// Without editing iOS uses PHPicker (instant, no photo permission); the organizer frames the square in our crop screen.
const OPTIONS = { mediaTypes: ["images"], allowsEditing: false, quality: 1 } satisfies ImagePicker.ImagePickerOptions;

/** The cover is a square (the hero of the join screen and the board), at most this many px a side. */
const COVER_SIZE = 1600;

/** Opens the library, then the crop screen to frame the square; resolves with the cropped photo, or null if cancelled. Shared by the board and Create. */
export async function pickCoverPhoto(): Promise<{ uri: string; width: number; height: number } | null> {
  const result = await ImagePicker.launchImageLibraryAsync(OPTIONS);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  const { id, result: cropped } = openCropRequest({ uri: asset.uri, width: asset.width, height: asset.height }, { shape: "square", size: COVER_SIZE });
  router.push({ pathname: "/crop-cover", params: { id } });
  return cropped;
}

/** Picks a photo from the library and uploads it as the event's cover; refreshes the detail and your list. */
export function useUploadCover(tripId: string) {
  const client = useQueryClient();
  const upload = useMutation({
    mutationFn: (photo: { uri: string; width: number; height: number }) => uploadCover(tripId, photo),
    onSuccess: () =>
      Promise.all([client.invalidateQueries({ queryKey: tripKey(tripId) }), client.invalidateQueries({ queryKey: myTripsKey })]),
  });
  const { mutateAsync, reset } = upload;

  const pick = async () => {
    reset();
    const photo = await pickCoverPhoto();
    if (photo) await mutateAsync(photo).catch(() => undefined);
  };

  return { pick, uploading: upload.isPending, error: errorMessage(upload.error, "No se pudo subir la foto") };
}
