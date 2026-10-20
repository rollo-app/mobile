import type { Schemas } from "@/api/client";

export type SessionStatus = "loading" | "out" | "in";

/** What the app shows first: the login, the profile step, the app, or a wait / retry. */
export type Gate = "loading" | "login" | "profile" | "app" | "error";

export function gateFor({
  session,
  me,
  meFailed,
}: {
  session: SessionStatus;
  me: Schemas["User"] | undefined;
  meFailed: boolean;
}): Gate {
  if (session === "loading") return "loading";
  if (session === "out") return "login";
  if (!me) return meFailed ? "error" : "loading";
  return me.name?.trim() ? "app" : "profile";
}
