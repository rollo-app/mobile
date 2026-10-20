import { router } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { useEffect } from "react";
import { useTodayLeft } from "@/features/capture/use-today-left";
import { scheduleRevealNotification } from "@/features/notifications/reveal";
import { useFirstPresentation } from "@/features/reveal/use-first-presentation";
import { tabsFor } from "@/features/trips/tabs";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useRollPhase } from "@/features/trips/use-roll-phase";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { colors } from "@/ui/theme";

/**
 * Bottom bar, icons only. The center camera isn't a screen: it's
 * `disabled` so tapping it doesn't switch tabs, and it opens capture on top.
 * Shows how many photos you have left today, or a lock if none are left or the roll isn't active.
 * After the reveal the same five tabs become Galería, Mapa, Presentación, (Feed hidden) and Perfil.
 */
export default function TabsLayout() {
  const { trip } = useActiveTrip();
  const { detail } = useTripDetail(trip?.tripId);
  const left = useTodayLeft(trip?.tripId, detail);
  const phase = useRollPhase(detail);
  const tabs = tabsFor(phase, left);

  // The phone knows when the reveal happens: it's announced with a local notification.
  const info = detail?.trip;
  useEffect(() => {
    if (info) void scheduleRevealNotification(info);
  }, [info?.id, info?.name, info?.revealAt, info?.revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  useFirstPresentation(trip?.tripId, phase === "revealed");

  return (
    <NativeTabs tintColor={colors.tint} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="roll">
        <NativeTabs.Trigger.Icon sf={tabs.roll.sf} md={tabs.roll.md} />
        <NativeTabs.Trigger.Label hidden>{tabs.roll.label}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Icon sf={{ default: "map", selected: "map.fill" }} md="map" />
        <NativeTabs.Trigger.Label hidden>Mapa</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="camera" disabled listeners={{ tabPress: () => router.push(tabs.camera.target) }}>
        <NativeTabs.Trigger.Icon sf={tabs.camera.sf} md={tabs.camera.md} />
        <NativeTabs.Trigger.Label hidden>{tabs.camera.label}</NativeTabs.Trigger.Label>
        {tabs.camera.badge !== null && <NativeTabs.Trigger.Badge>{tabs.camera.badge}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
      {/* Hiding a tab remounts the navigator: it only happens when the roll changes or at the moment of the reveal. */}
      <NativeTabs.Trigger name="feed" hidden={tabs.feedHidden}>
        <NativeTabs.Trigger.Icon sf={{ default: "text.bubble", selected: "text.bubble.fill" }} md="chat_bubble" />
        <NativeTabs.Trigger.Label hidden>Feed</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} md="account_circle" />
        <NativeTabs.Trigger.Label hidden>Perfil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
