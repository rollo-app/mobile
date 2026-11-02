import { ApiError } from "@/api/client";
import { INVALID_LINK } from "./handle-friend-link";

/** "expired": the link is dead (bad, unknown or past its hour); "unavailable": it may work, we just couldn't open it. */
export type FriendLinkFailure = "expired" | "unavailable";

export function friendLinkFailure(error: unknown): FriendLinkFailure {
  if (error instanceof ApiError) return error.status === 400 || error.status === 404 ? "expired" : "unavailable";
  if (error instanceof Error && error.message === INVALID_LINK) return "expired";
  return "unavailable";
}
