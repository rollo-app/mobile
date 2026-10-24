import type * as ImagePicker from "expo-image-picker";
import { formatDate, formatTime, rollPhase } from "@/features/trips/phase";

export type Left = { photos: number; videos: number } | null;

/** What to show instead of the camera when the roll isn't in its shooting phase; null while it is. */
export function closedMessage(
  trip: { startsAt: number; endsAt: number; revealAt: number; revealed: boolean; timezone: string },
  now: number,
) {
  const at = (ms: number) => `el ${formatDate(ms, trip.timezone)} a las ${formatTime(ms, trip.timezone)}`;
  switch (rollPhase(trip, now)) {
    case "upcoming":
      return { title: "Este rollo todavía no empezó", body: `Arranca ${at(trip.startsAt)}.` };
    case "ended":
      return { title: "Este rollo ya terminó", body: `Se revela ${at(trip.revealAt)}.` };
    case "revealed":
      return { title: "Este rollo ya se reveló", body: "Ya no se pueden sacar fotos." };
    default:
      return null;
  }
}

/** Which media the camera offers, given what's left of today's quota. */
export function mediaTypesFor(left: Left): ImagePicker.MediaType[] {
  if (left?.videos === 0) return ["images"];
  if (left?.photos === 0) return ["videos"];
  return ["images", "videos"];
}
