import * as Burnt from "burnt";
import { router, type Href } from "expo-router";
import { localDay } from "@/features/capture/quota";
import { requestPushPermission } from "@/features/notifications/push-permission";
import { scheduleMomentNotification } from "@/features/moments/moment-sync";
import { momentNotificationId } from "@/features/moments/plan";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { setActiveTripId } from "@/storage/active-trip";
import { forgetMomentIntro } from "@/storage/moment-intro";
import { Row } from "@/ui/components";

/**
 * Dev only: replay the animated moments. "Ver revelado" plays the reveal of the active
 * roll if it's revealed (always, seen or not), or switches to the first revealed one; "Ver candado" opens the lock → camera; "Ver intro" opens the new account's full-screen intro; "Probar momento ahora" schedules a moment notification in 10 s (and replays its intro).
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

  /**
   * Schedules the moment notification of the active roll for 10 seconds from now (same content as the real ones).
   * Asks for notification permission first: the dev build with seeded accounts never went through the primer.
   */
  async function testMoment() {
    if (!trip || !detail) return;
    if (!(await requestPushPermission())) {
      Burnt.alert({ preset: "error", title: "Activá las notificaciones", message: "Sin permiso el aviso no aparece." });
      return;
    }
    const notifyAt = Date.now() + 10_000;
    const day = localDay(notifyAt, detail.trip.timezone);
    // So the test always shows the moment's intro, even if this day's was already seen.
    await forgetMomentIntro(trip.id, day);
    await scheduleMomentNotification({ id: momentNotificationId(trip.id, day), tripId: trip.id, tripName: trip.name, day, notifyAt });
    Burnt.toast({ title: "Llega en 10 segundos", preset: "done" });
  }

  return (
    <>
      <Row label={revealed ? "Ver revelado" : "Ver revelado (no hay rollos revelados)"} onPress={revealed ? () => void openReveal() : undefined} />
      <Row label="Probar momento ahora" chevron={false} onPress={trip && detail ? () => void testMoment() : undefined} />
      <Row label="Ver candado" onPress={() => router.push("/roll-started")} />
      <Row label="Ver intro" onPress={() => router.push("/intro")} />
      <Row label="Peor caso (perfil)" onPress={() => router.push("/dev/worst-case" as Href)} />
    </>
  );
}
