import { useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import { userKey } from "@/features/profile/use-user";
import { feedKey } from "@/features/trips/use-feed";
import type { Feed } from "@/features/trips/actions";
import {
  reportMedia as reportMediaAction,
  reportUser as reportUserAction,
  type ReportReason,
} from "./actions";
import { pickReportReason } from "./report-sheet";

/** Asks why, reports, and on success hides what was reported. Cancelling or failing hides nothing and returns false. */
export function useReport() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (
      title: string,
      send: (reason: ReportReason) => Promise<void>,
      onDone: () => void,
    ): Promise<boolean> => {
      const reason = await pickReportReason(title);
      if (!reason) return false;
      setBusy(true);
      try {
        await send(reason);
      } catch {
        Burnt.alert({
          preset: "error",
          title: "No se pudo denunciar",
          message: "Probá de nuevo cuando tengas señal.",
        });
        return false;
      } finally {
        setBusy(false);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone();
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      void queryClient.invalidateQueries({ queryKey: ["featured"] });
      return true;
    },
    [queryClient],
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
  const reportUser = useCallback(
    (userId: string, name: string) =>
      run(
        `¿Por qué denunciás a ${name}?`,
        (reason) => reportUserAction(userId, reason),
        () => void queryClient.invalidateQueries({ queryKey: userKey(userId) }),
      ),
    [run, queryClient],
  );

  return { busy, reportMedia, reportUser };
}
