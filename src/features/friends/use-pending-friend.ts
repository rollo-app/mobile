import { useEffect, useRef } from "react";
import { queryClient } from "@/api/query-client";
import { ApiError } from "@/api/client";
import { clearPendingFriend, getPendingFriend } from "@/storage/pending-friend";
import { redeemFriend } from "./actions";
import { friendsKey } from "./use-friends";

/** Without signal, or a busy server, the permission is kept for the next try; a rejected one is useless. */
const keepPending = (error: unknown) => error instanceof ApiError && (error.status === 0 || error.status === 429 || error.status >= 500);

/** The only place where a pending friend link is redeemed. Failing never gets in the way of the sign-up. */
export async function redeemPendingFriend(): Promise<void> {
  const pending = await getPendingFriend();
  if (!pending) return;
  try {
    await redeemFriend({ claimToken: pending.claimToken });
    await clearPendingFriend();
    await queryClient.invalidateQueries({ queryKey: friendsKey });
  } catch (e) {
    if (!keepPending(e)) await clearPendingFriend();
  }
}

/** Redeems the pending link as soon as the account is ready (`enabled`), once per run. */
export function useRedeemPendingFriend(enabled: boolean) {
  const running = useRef(false);
  useEffect(() => {
    if (!enabled || running.current) return;
    running.current = true;
    void redeemPendingFriend().finally(() => {
      running.current = false;
    });
  }, [enabled]);
}
