import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import type { FailedMedia, PendingMedia } from "./queue";
import { getSessionUserId } from "@/features/auth/session";
import { getQueue } from "./store";
import { summarize, type UploadSummary } from "./upload-status";
import { pendingKey } from "./use-pending-count";
import { pendingItemsKey } from "./use-pending-items";

export const uploadStatusKey = (tripId: string) => ["upload-status", tripId] as const;

/** Every key that reflects the local queue: invalidate them together when it changes. */
export const queueKeys = (tripId: string) => [pendingKey(tripId), pendingItemsKey(tripId), uploadStatusKey(tripId)];

export type UploadStatus = UploadSummary & { pending: PendingMedia[]; failed: FailedMedia[] };

const EMPTY: UploadStatus = { ...summarize([], []), pending: [], failed: [] };

/** What is waiting to upload and what failed for good, for a trip (the local queue; no network). */
export function useUploadStatus(tripId: string | undefined): UploadStatus {
  const query = useQuery({
    queryKey: uploadStatusKey(tripId ?? ""),
    queryFn: async (): Promise<UploadStatus> => {
      const owner = await getSessionUserId();
      if (!owner) return EMPTY;
      const queue = await getQueue();
      const [pending, failed] = await Promise.all([queue.pendingForTrip(owner, tripId!), queue.failedForTrip(owner, tripId!)]);
      return { ...summarize(pending, failed), pending, failed };
    },
    enabled: !!tripId,
    networkMode: "always",
    staleTime: 0,
  });

  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (tripId) void refetch();
    }, [tripId, refetch]),
  );

  return query.data ?? EMPTY;
}
