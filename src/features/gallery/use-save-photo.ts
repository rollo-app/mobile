import * as Haptics from "expo-haptics";
import { useState } from "react";
import type { RevealedPhoto } from "@/features/media/revealed";
import { PermissionDeniedError, linkedImage } from "./save";
import type { useSaver } from "./use-saver";

export type SaveState = "idle" | "saving" | "saved" | "failed" | "denied";

/** "Guardar" saves the image that is big: the moment's linked one once it was swapped in. */
export function savedTarget(photo: RevealedPhoto, selfieBig: boolean) {
  return selfieBig && photo.selfie ? linkedImage(photo) : photo;
}

/** Save to Photos with a state per saved image (by media id) and a success haptic. */
export function useSavePhoto(saver: ReturnType<typeof useSaver>) {
  const [saves, setSaves] = useState<Record<string, SaveState>>({});

  async function save(target: RevealedPhoto) {
    if (!saver) return;
    setSaves((s) => ({ ...s, [target.id]: "saving" }));
    try {
      await saver(target);
      setSaves((s) => ({ ...s, [target.id]: "saved" }));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setSaves((s) => ({ ...s, [target.id]: e instanceof PermissionDeniedError ? "denied" : "failed" }));
    }
  }

  return { saves, save };
}
