import { router } from "expo-router";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { setActiveTripId } from "@/storage/active-trip";
import { Row } from "@/ui/components";

/**
 * Spike (dev only): replay the animated moments. "Ver revelado" plays the reveal of the active
 * roll if it's revealed (always, seen or not), or switches to the first revealed one; "Ver candado" opens the lock → camera.
 */
export function DevMomentRows() {
  const { trip, trips } = useActiveTrip();
  const revealed = trip?.revealed ? trip : trips.find((t) => t.revealed);

  async function openReveal() {
    if (!revealed) return;
    if (revealed.id !== trip?.id) await setActiveTripId(revealed.id);
    router.push("/reveal");
  }

  return (
    <>
      <Row label={revealed ? "Ver revelado" : "Ver revelado (no hay rollos revelados)"} onPress={revealed ? () => void openReveal() : undefined} />
      <Row label="Ver candado" onPress={() => router.push("/roll-started")} />
    </>
  );
}
