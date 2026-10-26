import { formatDate, formatTime, rollPhase } from "@/features/trips/phase";

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

/** Shown instead of the camera when you have no photos left; depends on whether the limit is per day or for the whole rollo. */
export function exhaustedMessage(trip: { photoLimitMode?: "daily" | "total"; dailyPhotoLimit: number } | null) {
  if (trip?.photoLimitMode === "total") {
    return { title: "Ya usaste todas tus fotos del rollo", body: "Lo que sacaste lo ves en el revelado." };
  }
  const n = trip?.dailyPhotoLimit;
  return {
    title: "Se terminó el rollo de hoy",
    body: n ? `Mañana tenés ${n} ${n === 1 ? "foto nueva" : "fotos nuevas"}.` : "Mañana se renueva.",
  };
}

/** "Tenés 7 fotos hoy." / "Tenés 7 fotos en el rollo." */
export function photosLeftText(photos: number, mode: "daily" | "total" | undefined) {
  return `Tenés ${photos} ${photos === 1 ? "foto" : "fotos"} ${mode === "total" ? "en el rollo" : "hoy"}.`;
}
