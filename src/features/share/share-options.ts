import type { RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";
import { collageCandidates } from "./collage";
import { canShareInvite } from "./invite";

export type ShareKind = "invite" | "collage";
export type ShareOption = "link" | "whatsapp" | "instagram";

/** What the roll can share now: the invitation before the reveal (while there's room), the collage after it (public roll with shareable photos). */
export function shareKind(detail: TripDetail, photos: RevealedPhoto[]): ShareKind | null {
  if (!detail.trip.revealed) return canShareInvite(detail) ? "invite" : null;
  return !detail.trip.featuringDisabled && collageCandidates(photos).length > 0 ? "collage" : null;
}

/** The sheet's rows, in order. The collage is an image, so it has no "Copiar link"; WhatsApp only when it is installed. */
export function shareOptions(kind: ShareKind, whatsapp: boolean): ShareOption[] {
  const all: ShareOption[] = kind === "invite" ? ["link", "whatsapp", "instagram"] : ["whatsapp", "instagram"];
  return whatsapp ? all : all.filter((o) => o !== "whatsapp");
}
