import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useRef, useState } from "react";
import { meKey } from "@/features/auth/actions";
import { uploadAvatar } from "./actions";

export type PhotoSource = "camera" | "library";

type Photo = { uri: string; width: number; height: number };

const PICKER_OPTIONS = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 } satisfies ImagePicker.ImagePickerOptions;

/**
 * Picks a profile photo (native square crop) and uploads it right away. Until the server confirms,
 * `localUri` is the photo to show with a spinner; if it fails, `error` says why and `retry` tries again.
 */
export function useAvatarUpload() {
  const queryClient = useQueryClient();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = useRef<Photo | null>(null);

  const send = useCallback(
    async (photo: Photo) => {
      last.current = photo;
      setLocalUri(photo.uri);
      setError(null);
      setUploading(true);
      try {
        const user = await uploadAvatar(photo);
        queryClient.setQueryData(meKey, user);
        void queryClient.invalidateQueries({ queryKey: ["trip"] });
        void queryClient.invalidateQueries({ queryKey: ["feed"] });
        last.current = null;
        setLocalUri(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo subir la foto");
      } finally {
        setUploading(false);
      }
    },
    [queryClient],
  );

  const pick = useCallback(
    async (source: PhotoSource) => {
      setError(null);
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError("Rollo no tiene permiso para usar la cámara. Activalo en Ajustes.");
          return;
        }
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
          : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
      const asset = result.canceled ? null : result.assets[0];
      if (asset) await send({ uri: asset.uri, width: asset.width, height: asset.height });
    },
    [send],
  );

  const retry = useCallback(() => (last.current ? send(last.current) : Promise.resolve()), [send]);

  return { localUri, uploading, error, pick, retry };
}
