import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { userKey } from "@/features/profile/use-user";
import { feedKey } from "@/features/trips/use-feed";
import type { Feed } from "@/features/trips/actions";
import {
  reportComment as reportCommentAction,
  reportMedia as reportMediaAction,
  reportUser as reportUserAction,
  type ReportReason,
} from "./actions";
import { pickReportReason } from "./report-sheet";

/** Asks why, reports, and on success hides what was reported. Cancelling or failing hides nothing and returns false. */
export function useReport() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ reason, send }: { reason: ReportReason; send: (reason: ReportReason) => Promise<void>; onDone: () => void }) => send(reason),
    onSuccess: (_data, { onDone }) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone();
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      void queryClient.invalidateQueries({ queryKey: ["featured"] });
    },
    onError: () =>
      Burnt.alert({
        preset: "error",
        title: "No se pudo denunciar",
        message: "Probá de nuevo cuando tengas señal.",
      }),
  });
  const { mutateAsync } = mutation;

  const run = useCallback(
    async (title: string, send: (reason: ReportReason) => Promise<void>, onDone: () => void): Promise<boolean> => {
      const reason = await pickReportReason(title);
      if (!reason) return false;
      try {
        await mutateAsync({ reason, send, onDone });
        return true;
      } catch {
        return false;
      }
    },
    [mutateAsync],
  );

  const reportMedia = useCallback(
    ({ mediaId, tripId }: { mediaId: string; tripId?: string }) =>
      run(
        "¿Por qué denunciás esta foto?",
        (reason) => reportMediaAction(mediaId, reason),
        () => {
          if (tripId) {
            queryClient.setQueryData<Feed>(
              feedKey(tripId),
              (feed) =>
                feed && {
                  ...feed,
                  items: feed.items.filter((i) => i.id !== mediaId),
                },
            );
          }
        },
      ),
    [run, queryClient],
  );
  const reportComment = useCallback(
    (commentId: string) =>
      run(
        "¿Por qué denunciás este comentario?",
        (reason) => reportCommentAction(commentId, reason),
        () => void queryClient.invalidateQueries({ queryKey: ["comments"] }),
      ),
    [run, queryClient],
  );
  const reportUser = useCallback(
    (userId: string, name: string) =>
      run(
        `¿Por qué denunciás a ${name}?`,
        (reason) => reportUserAction(userId, reason),
        () => void queryClient.invalidateQueries({ queryKey: userKey(userId) }),
      ),
    [run, queryClient],
  );

  return { busy: mutation.isPending, reportMedia, reportComment, reportUser };
}
