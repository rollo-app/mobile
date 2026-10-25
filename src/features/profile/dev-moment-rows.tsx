import { router } from "expo-router";
import { localDay } from "@/features/capture/quota";
import { scheduleMomentNotification } from "@/features/moments/moment-sync";
import { momentNotificationId } from "@/features/moments/plan";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { setActiveTripId } from "@/storage/active-trip";
import { Row } from "@/ui/components";

/**
 * Dev only: replay the animated moments. "Ver revelado" plays the reveal of the active
 * roll if it's revealed (always, seen or not), or switches to the first revealed one; "Ver candado" opens the lock → camera; "Probar momento ahora" schedules a moment notification in 10 s.
 */
export function DevMomentRows() {
  const { trip, trips } = useActiveTrip();
  const { detail } = useTripDetail(trip?.id);
  const revealed = trip?.revealed ? trip : trips.find((t) => t.revealed);

  async function openReveal() {
    if (!revealed) return;
    if (revealed.id !== trip?.id) await setActiveTripId(revealed.id);
    router.push("/reveal");
  }

  /** Schedules the moment notification of the active roll for 10 seconds from now (same content as the real ones). */
  async function testMoment() {
    if (!trip || !detail) return;
    const notifyAt = Date.now() + 10_000;
    const day = localDay(notifyAt, detail.trip.timezone);
    await scheduleMomentNotification({ id: momentNotificationId(trip.id, day), tripId: trip.id, tripName: trip.name, day, notifyAt });
  }

  return (
    <>
      <Row label={revealed ? "Ver revelado" : "Ver revelado (no hay rollos revelados)"} onPress={revealed ? () => void openReveal() : undefined} />
      <Row label="Probar momento ahora" onPress={trip && detail ? () => void testMoment() : undefined} />
      <Row label="Ver candado" onPress={() => router.push("/roll-started")} />
    </>
  );
}
