import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { errorMessage } from "@/api/client";
import { meKey } from "@/features/auth/actions";
import { uploadAvatar } from "./actions";
import { openCropRequest, type Photo } from "./crop-request";

export type PhotoSource = "camera" | "library";

// The camera's native square crop is quick.
const CAMERA_OPTIONS = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 } satisfies ImagePicker.ImagePickerOptions;
// With allowsEditing the library falls back to the legacy UIImagePickerController, which loads the whole
// library before showing anything. Without it, iOS uses PHPicker (instant, no photo permission) and we crop.
const LIBRARY_OPTIONS = { mediaTypes: ["images"], allowsEditing: false, quality: 1 } satisfies ImagePicker.ImagePickerOptions;

/** Opens our own crop screen; resolves with the cropped photo or null if cancelled. */
async function cropInApp(photo: Photo): Promise<Photo | null> {
  const { id, result } = openCropRequest(photo);
  router.push({ pathname: "/crop-avatar", params: { id } });
  return result;
}

/**
 * Picks a profile photo (camera: native square crop; library: our crop screen) and uploads it right away. Until the server confirms,
 * `localUri` is the photo to show with a spinner; if it fails, `error` says why and `retry` tries again.
 */
export function useAvatarUpload() {
  const queryClient = useQueryClient();
  const [localUri, setLocalUri] = useState<string | null>(null);
  // Camera permission denial happens before any upload, so it isn't a mutation error.
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const last = useRef<Photo | null>(null);

  const upload = useMutation({
    mutationFn: (photo: Photo) => uploadAvatar(photo),
    onSuccess: (user) => {
      queryClient.setQueryData(meKey, user);
      void queryClient.invalidateQueries({ queryKey: ["trip"] });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      last.current = null;
      setLocalUri(null);
    },
  });
  const { mutateAsync, reset } = upload;

  const send = useCallback(
    async (photo: Photo) => {
      last.current = photo;
      setLocalUri(photo.uri);
      setPermissionError(null);
      reset();
      // Failures surface through `upload.error`.
      await mutateAsync(photo).catch(() => undefined);
    },
    [mutateAsync, reset],
  );

  const pick = useCallback(
    async (source: PhotoSource) => {
      setPermissionError(null);
      reset();
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setPermissionError("Rollo no tiene permiso para usar la cámara. Activalo en Ajustes.");
          return;
        }
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(CAMERA_OPTIONS)
          : await ImagePicker.launchImageLibraryAsync(LIBRARY_OPTIONS);
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      const photo = { uri: asset.uri, width: asset.width, height: asset.height };
      // Without a size (iOS can report 0×0) the crop can't be laid out: send it as is.
      const croppable = photo.width > 0 && photo.height > 0;
      const ready = source === "camera" || !croppable ? photo : await cropInApp(photo);
      if (ready) await send(ready);
    },
    [send, reset],
  );

  const retry = useCallback(() => (last.current ? send(last.current) : Promise.resolve()), [send]);

  return { localUri, uploading: upload.isPending, error: permissionError ?? errorMessage(upload.error, "No se pudo subir la foto"), pick, retry };
}
