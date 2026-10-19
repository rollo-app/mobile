import { router } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { useTodayLeft } from "@/features/capture/use-today-left";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useRollPhase } from "@/features/trips/use-roll-phase";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { colors } from "@/ui/theme";

/**
 * Bottom bar, icons only. The center camera isn't a screen: it's
 * `disabled` so tapping it doesn't switch tabs, and it opens capture on top.
 * Shows how many photos you have left today, or a lock if none are left or the roll isn't active.
 */
export default function TabsLayout() {
  const { trip } = useActiveTrip();
  const { detail } = useTripDetail(trip?.tripId);
  const left = useTodayLeft(trip?.tripId, detail);
  const phase = useRollPhase(detail);
  // Outside the shooting phase the camera is closed, whatever the quota says.
  const closed = phase !== null && phase !== "active";
  const locked = closed || (left !== null && left.photos === 0 && left.videos === 0);

  return (
    <NativeTabs tintColor={colors.tint} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="roll">
        <NativeTabs.Trigger.Icon sf={{ default: "film", selected: "film.fill" }} md="movie" />
        <NativeTabs.Trigger.Label hidden>Rollo</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Icon sf={{ default: "map", selected: "map.fill" }} md="map" />
        <NativeTabs.Trigger.Label hidden>Mapa</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="camera" disabled listeners={{ tabPress: () => router.push("/capture") }}>
        <NativeTabs.Trigger.Icon sf={locked ? "lock.fill" : "camera.fill"} md={locked ? "lock" : "photo_camera"} />
        <NativeTabs.Trigger.Label hidden>{closed ? "Cámara, rollo cerrado" : locked ? "Cámara, sin fotos por hoy" : "Cámara"}</NativeTabs.Trigger.Label>
        {!closed && left !== null && left.photos > 0 && <NativeTabs.Trigger.Badge>{String(left.photos)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="feed">
        <NativeTabs.Trigger.Icon sf={{ default: "text.bubble", selected: "text.bubble.fill" }} md="chat_bubble" />
        <NativeTabs.Trigger.Label hidden>Feed</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} md="account_circle" />
        <NativeTabs.Trigger.Label hidden>Vos</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
