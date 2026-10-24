import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import type * as ImagePicker from "expo-image-picker";
import type { Fix } from "./location";
import { prepareMedia } from "./media";
import { localDay } from "./quota";
import { getQueue } from "./store";
import { syncQueue } from "./sync";
import { pendingKey } from "./use-pending-count";
import { pendingItemsKey } from "./use-pending-items";

export type SendShotInput = {
  tripId: string;
  asset: ImagePicker.ImagePickerAsset;
  takenAt: number;
  timeZone: string;
  caption: string;
  author: string;
  /** The location fix started when the camera opened (may resolve to null). */
  fix: Promise<Fix | null> | null;
};

async function sendShot(input: SendShotInput) {
  const { tripId, asset, takenAt, timeZone, author } = input;
  const caption = input.caption.trim() || null;
  const id = Crypto.randomUUID();
  // The EXIF written into the photo needs the fix, so prepare after it (it has its own timeout).
  const location = await input.fix;
  const prepared = await prepareMedia(asset, id, { takenAt, timeZone, location, caption, author });
  await (await getQueue()).enqueue({
    id,
    tripId,
    type: asset.type === "video" ? "video" : "photo",
    takenAt,
    day: localDay(takenAt, timeZone),
    lat: location?.lat ?? null,
    lng: location?.lng ?? null,
    accuracyM: location?.accuracyM ?? null,
    caption,
    ...prepared,
  });
}

/**
 * Prepares a shot and enqueues it in the local queue (works offline: mutations run with
 * `networkMode: "always"`), then refreshes the pending counters and kicks the upload.
 */
export function useSendShot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendShotInput) => sendShot(input),
    onSuccess: (_data, { tripId }) => {
      void queryClient.invalidateQueries({ queryKey: pendingKey(tripId) });
      void queryClient.invalidateQueries({ queryKey: pendingItemsKey(tripId) });
      void syncQueue();
    },
  });
}
