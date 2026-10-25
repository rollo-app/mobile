import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Directory, Paths } from "expo-file-system";
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
  /** The "momento del día" this shot belongs to (trip-local YYYY-MM-DD). */
  momentDay?: string;
  /** Moment selfie: enqueued after the main, paired with it. */
  selfie?: { asset: ImagePicker.ImagePickerAsset; takenAt: number };
};

/** The moment selfie is small: it only decorates the main photo. */
const SELFIE_MAX = 1080;

async function sendShot(input: SendShotInput) {
  const { tripId, asset, takenAt, timeZone, author } = input;
  const caption = input.caption.trim() || null;
  const id = Crypto.randomUUID();
  // The EXIF written into the photo needs the fix, so prepare after it (it has its own timeout).
  const location = await input.fix;
  const prepared = await prepareMedia(asset, id, { takenAt, timeZone, location, caption, author });
  const withSelfie = input.selfie && input.momentDay ? { selfie: input.selfie, momentDay: input.momentDay } : null;
  const selfieId = Crypto.randomUUID();
  let selfiePrepared: Awaited<ReturnType<typeof prepareMedia>> | null = null;
  if (withSelfie) {
    // Prepare both before enqueuing anything: if the selfie fails, no orphan main stays queued.
    try {
      selfiePrepared = await prepareMedia(
        withSelfie.selfie.asset,
        selfieId,
        { takenAt: withSelfie.selfie.takenAt, timeZone, location, caption: null, author },
        { maxDimension: SELFIE_MAX },
      );
    } catch (e) {
      try {
        const dir = new Directory(Paths.document, "pending", id);
        if (dir.exists) dir.delete();
      } catch {
        // Best effort: the main's files are unreferenced anyway.
      }
      throw e;
    }
  }
  const queue = await getQueue();
  await queue.enqueue({
    id,
    tripId,
    type: asset.type === "video" ? "video" : "photo",
    takenAt,
    day: localDay(takenAt, timeZone),
    lat: location?.lat ?? null,
    lng: location?.lng ?? null,
    accuracyM: location?.accuracyM ?? null,
    caption,
    momentDay: input.momentDay ?? null,
    pairedWith: null,
    ...prepared,
  });
  if (withSelfie && selfiePrepared) {
    await queue.enqueue({
      id: selfieId,
      tripId,
      type: "photo",
      takenAt: withSelfie.selfie.takenAt,
      day: localDay(withSelfie.selfie.takenAt, timeZone),
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
      accuracyM: location?.accuracyM ?? null,
      caption: null,
      momentDay: withSelfie.momentDay,
      pairedWith: id,
      ...selfiePrepared,
    });
  }
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
