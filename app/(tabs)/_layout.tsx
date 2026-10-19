import { router } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { colors } from "@/ui/theme";

/**
 * Barra de abajo, solo íconos. La cámara del centro no es una pantalla: está
 * `disabled` para que tocarla no cambie de tab y abre la captura encima.
 */
export default function TabsLayout() {
  return (
    <NativeTabs tintColor={colors.label}>
      <NativeTabs.Trigger name="rollo">
        <NativeTabs.Trigger.Icon sf={{ default: "film", selected: "film.fill" }} md="movie" />
        <NativeTabs.Trigger.Label hidden>Rollo</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mapa">
        <NativeTabs.Trigger.Icon sf={{ default: "map", selected: "map.fill" }} md="map" />
        <NativeTabs.Trigger.Label hidden>Mapa</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="camara" disabled listeners={{ tabPress: () => router.push("/capture") }}>
        <NativeTabs.Trigger.Icon sf="camera.fill" md="photo_camera" />
        <NativeTabs.Trigger.Label hidden>Cámara</NativeTabs.Trigger.Label>
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
