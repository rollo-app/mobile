import { router } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { useRollStarted } from "@/features/capture/use-roll-started";
import { useTodayLeft } from "@/features/capture/use-today-left";
import { useAppIntro } from "@/features/intro/use-app-intro";
import { useMomentSync } from "@/features/moments/use-moment-sync";
import { useTabAvatar } from "@/features/profile/use-tab-avatar";
import { useFirstPresentation } from "@/features/reveal/use-first-presentation";
import { hasNoTrips } from "@/features/trips/active";
import { tabsFor } from "@/features/trips/tabs";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useRollPhase } from "@/features/trips/use-roll-phase";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { colors } from "@/ui/theme";

/**
 * Bottom bar, icons only. The center camera isn't a screen: it's
 * `disabled` so tapping it doesn't switch tabs, and it opens capture on top.
 * Shows how many photos you have left today, or a lock if none are left or the roll isn't active.
 * After the reveal the roll and camera tabs become Galería and Presentación. The Feed lives inside Mapa. Amigos is global: it's there with or without rolls.
 */
export default function TabsLayout() {
  const { trip, loaded } = useActiveTrip();
  const { detail } = useTripDetail(trip?.id);
  const left = useTodayLeft(trip?.id, detail);
  const phase = useRollPhase(detail);
  const tabs = tabsFor(phase, left, !hasNoTrips(loaded, trip));
  const avatar = useTabAvatar();

  useFirstPresentation(trip?.id, phase === "revealed", loaded);
  useRollStarted(trip?.id, phase, loaded);
  useAppIntro();
  useMomentSync();

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
      <NativeTabs.Trigger name="camera" disabled listeners={{ tabPress: () => (tabs.camera.target === "/roll" ? router.navigate("/roll") : router.push(tabs.camera.target)) }}>
        <NativeTabs.Trigger.Icon sf={tabs.camera.sf} md={tabs.camera.md} />
        <NativeTabs.Trigger.Label hidden>{tabs.camera.label}</NativeTabs.Trigger.Label>
        {tabs.camera.badge !== null && <NativeTabs.Trigger.Badge>{tabs.camera.badge}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="friends">
        <NativeTabs.Trigger.Icon sf={{ default: "person.2", selected: "person.2.fill" }} md="group" />
        <NativeTabs.Trigger.Label hidden>Amigos</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        {avatar ? (
          // `src` and `sf` can't be mixed (sf wins on iOS), so the photo is a separate element.
          <NativeTabs.Trigger.Icon src={avatar} renderingMode="original" md="account_circle" />
        ) : (
          <NativeTabs.Trigger.Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} md="account_circle" />
        )}
        <NativeTabs.Trigger.Label hidden>Perfil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
