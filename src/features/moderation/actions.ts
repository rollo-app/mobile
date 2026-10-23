import { unwrap, type Schemas } from "@/api/client";
import { authedClient } from "@/features/auth/session";
import type { Friend } from "@/features/friends/actions";

export type ReportReason = Schemas["ReportReason"];

/** Reports a photo or video to the moderators. Reporting twice is fine: the server answers 204 both times. */
export async function reportMedia(mediaId: string, reason: ReportReason): Promise<void> {
  await unwrap((await authedClient()).POST("/reports", { body: { mediaId, reason } }));
}

/** Reports a person to the moderators. */
export async function reportUser(userId: string, reason: ReportReason): Promise<void> {
  await unwrap((await authedClient()).POST("/reports", { body: { userId, reason } }));
}

/** Blocks someone; idempotent. */
export async function blockUser(userId: string): Promise<void> {
  await unwrap((await authedClient()).PUT("/blocks/{userId}", { params: { path: { userId } } }));
}

export async function unblockUser(userId: string): Promise<void> {
  await unwrap((await authedClient()).DELETE("/blocks/{userId}", { params: { path: { userId } } }));
}

export async function fetchBlocked(): Promise<Friend[]> {
  return (await unwrap((await authedClient()).GET("/blocks"))).blocked;
}
