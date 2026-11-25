import type { RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";
import { collageCandidates } from "./collage";
import { canShareInvite } from "./invite";

export type ShareKind = "invite" | "collage";

/** What the roll can share now: the invitation before the reveal (while there's room), the collage after it (public roll with shareable photos). */
export function shareKind(detail: TripDetail, photos: RevealedPhoto[]): ShareKind | null {
  if (!detail.trip.revealed) return canShareInvite(detail) ? "invite" : null;
  return !detail.trip.featuringDisabled && collageCandidates(photos).length > 0 ? "collage" : null;
}
