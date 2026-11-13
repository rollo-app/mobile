import { router } from "expo-router";
import { useEffect } from "react";
import { isIntroBusy } from "@/features/intro/intro-state";
import { isAppIntroQueued } from "@/storage/app-intro";
import { clearPendingJoin, getPendingJoin } from "@/storage/pending-join";

let opening = false;

/**
 * Opens the join screen with the saved code (the user still picks groups there). While the new-account intro is
 * opening or on screen it does nothing: the intro calls this again when it ends.
 */
export async function openPendingJoin(): Promise<void> {
  if (opening || isIntroBusy()) return;
  opening = true;
  try {
    const pending = await getPendingJoin();
    // The intro is queued but its tabs haven't mounted yet: it will call this again when it ends.
    if (!pending || isIntroBusy() || (await isAppIntroQueued())) return;
    await clearPendingJoin();
    // The Rollo tab is where sign-up lands anyway; going there first keeps the home redirect from covering the join screen.
    router.replace("/roll");
    router.push({ pathname: "/join", params: { code: pending.code } });
  } finally {
    opening = false;
  }
}

/** Opens the pending join as soon as the account is ready (`enabled`). */
export function useOpenPendingJoin(enabled: boolean) {
  useEffect(() => {
    if (enabled) void openPendingJoin().catch(() => {});
  }, [enabled]);
}
