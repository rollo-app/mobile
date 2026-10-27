import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Directory, Paths } from "expo-file-system";
import type { CapturedPhoto } from "@/features/camera/captured-photo";
import type { Fix } from "./location";
import { prepareMedia } from "./media";
import { localDay } from "./quota";
import { getSessionUserId } from "@/features/auth/session";
import { getQueue } from "./store";
import { syncQueue } from "./sync";
import { pendingKey } from "./use-pending-count";
import { pendingItemsKey } from "./use-pending-items";

export type SendShotInput = {
  tripId: string;
  photo: CapturedPhoto;
  takenAt: number;
  timeZone: string;
  caption: string;
  author: string;
  /** The location fix started when the camera opened (may resolve to null). */
  fix: Promise<Fix | null> | null;
  /** The "momento del día" this shot belongs to (trip-local YYYY-MM-DD). */
  momentDay?: string;
  /** Which camera took `asset` (moment shots only). */
  facing?: Facing;
  /** The second image of a moment (the other camera): enqueued after the main, paired with it. */
  selfie?: { photo: CapturedPhoto; takenAt: number; facing?: Facing };
};

type Facing = "front" | "back";

/** The front camera's images are small whichever one was taken first: the back camera's keep the normal size. */
const FRONT_MAX = 1080;

function prepareFor(
  facing: Facing | undefined,
  ...args: [photo: CapturedPhoto, id: string, metadata: Parameters<typeof prepareMedia>[2]]
) {
  return facing === "front" ? prepareMedia(...args, { maxDimension: FRONT_MAX }) : prepareMedia(...args);
}

async function sendShot(input: SendShotInput) {
  const { tripId, photo, takenAt, timeZone, author } = input;
  const caption = input.caption.trim() || null;
  const id = Crypto.randomUUID();
  // The EXIF written into the photo needs the fix, so prepare after it (it has its own timeout).
  const location = await input.fix;
  const prepared = await prepareFor(input.facing, photo, id, { takenAt, timeZone, location, caption, author });
  const withSelfie = input.selfie && input.momentDay ? { selfie: input.selfie, momentDay: input.momentDay } : null;
  const selfieId = Crypto.randomUUID();
  let selfiePrepared: Awaited<ReturnType<typeof prepareMedia>> | null = null;
  if (withSelfie) {
    // Prepare both before enqueuing anything: if the linked one fails, no orphan main stays queued.
    try {
      selfiePrepared = await prepareFor(withSelfie.selfie.facing, withSelfie.selfie.photo, selfieId, {
        takenAt: withSelfie.selfie.takenAt,
        timeZone,
        location,
        caption: null,
        author,
      });
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
  // Null if the phone can't learn its account yet (old session, no network): the first account it learns claims it.
  const ownerUserId = await getSessionUserId();
  await queue.enqueue({
    ownerUserId,
    id,
    tripId,
    type: "photo",
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
      ownerUserId,
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
