import { router } from "expo-router";
import { useEffect } from "react";
import { gateFor } from "@/features/auth/gate";
import { useMe } from "@/features/auth/use-me";
import { JoinScreen } from "@/features/trips/join-screen";
import { setPendingJoin } from "@/storage/pending-join";

/**
 * The join modal is reachable without an account only through a link: then the code is kept (and the sign-up
 * goes on), and `useOpenPendingJoin` opens it again when the profile is complete.
 */
export function JoinRoute({ code }: { code?: string }) {
  const { session, me, failed } = useMe();
  const gate = gateFor({ session, me, meFailed: failed });
  const waiting = gate === "login" || gate === "profile";

  useEffect(() => {
    if (!waiting) return;
    void (async () => {
      if (code) await setPendingJoin({ code: code.trim().toUpperCase().slice(0, 6) });
      router.replace("/");
    })();
  }, [waiting, code]);

  if (gate !== "app") return null;
  return <JoinScreen initialCode={code} />;
}
