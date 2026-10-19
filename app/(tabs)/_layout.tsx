import { router } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { useTodayLeft } from "@/features/capture/use-today-left";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { colors } from "@/ui/theme";

/**
 * Barra de abajo, solo íconos. La cámara del centro no es una pantalla: está
 * `disabled` para que tocarla no cambie de tab y abre la captura encima.
 * Muestra cuántas fotos te quedan hoy, o un candado si no queda nada.
 */
export default function TabsLayout() {
  const { trip } = useActiveTrip();
  const { detail } = useTripDetail(trip?.tripId);
  const left = useTodayLeft(trip?.tripId, detail);
  const locked = left !== null && left.photos === 0 && left.videos === 0;

  return (
    <NativeTabs tintColor={colors.tint} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="rollo">
        <NativeTabs.Trigger.Icon sf={{ default: "film", selected: "film.fill" }} md="movie" />
        <NativeTabs.Trigger.Label hidden>Rollo</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mapa">
        <NativeTabs.Trigger.Icon sf={{ default: "map", selected: "map.fill" }} md="map" />
        <NativeTabs.Trigger.Label hidden>Mapa</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="camara" disabled listeners={{ tabPress: () => router.push("/capture") }}>
        <NativeTabs.Trigger.Icon sf={locked ? "lock.fill" : "camera.fill"} md={locked ? "lock" : "photo_camera"} />
        <NativeTabs.Trigger.Label hidden>{locked ? "Cámara, sin fotos por hoy" : "Cámara"}</NativeTabs.Trigger.Label>
        {left !== null && left.photos > 0 && <NativeTabs.Trigger.Badge>{String(left.photos)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="feed">
        <NativeTabs.Trigger.Icon sf={{ default: "text.bubble", selected: "text.bubble.fill" }} md="chat_bubble" />
        <NativeTabs.Trigger.Label hidden>Feed</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="vos">
        <NativeTabs.Trigger.Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} md="account_circle" />
        <NativeTabs.Trigger.Label hidden>Vos</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
