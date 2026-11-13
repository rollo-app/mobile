import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { clearPendingJoin, getPendingJoin } from "@/storage/pending-join";

/** Opens the join screen with the saved code once the account is ready (`enabled`), once per run; the user still picks groups there. */
export function useOpenPendingJoin(enabled: boolean) {
  const running = useRef(false);
  useEffect(() => {
    if (!enabled || running.current) return;
    running.current = true;
    void (async () => {
      const pending = await getPendingJoin();
      if (!pending) return;
      await clearPendingJoin();
      // The Rollo tab is where sign-up lands anyway; going there first keeps the home redirect from covering the join screen.
      router.replace("/roll");
      router.push({ pathname: "/join", params: { code: pending.code } });
    })().finally(() => {
      running.current = false;
    });
  }, [enabled]);
}
