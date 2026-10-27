import { Fragment, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import { Button, ErrorText, Row, Screen, Section, SwitchRow } from "@/ui/components";
import { spacing } from "@/ui/theme";
import { useNotificationSettings, type NotificationKind } from "./use-notification-settings";
import { usePushPermission } from "./use-push-permission";

const GROUPS: { title: string; footer: string; kinds: { kind: NotificationKind; label: string }[] }[] = [
  {
    title: "Rollos",
    footer: "Se revela: cuando se pueden ver las fotos de un rollo tuyo.",
    kinds: [
      { kind: "addedToTrip", label: "Te suman a un rollo" },
      { kind: "tripStarted", label: "Arranca un rollo" },
      { kind: "tripRevealed", label: "Se revela un rollo" },
    ],
  },
  {
    title: "Amigos",
    footer: "Cuando alguien acepta tu link de amistad o te manda una solicitud.",
    kinds: [
      { kind: "newFriend", label: "Nuevos amigos" },
      { kind: "friendRequest", label: "Solicitudes de amistad" },
    ],
  },
  {
    title: "Tus fotos",
    footer: "Cuando alguien destaca, le da me gusta o comenta una foto tuya (o una que comentaste).",
    kinds: [
      { kind: "photoFeatured", label: "Destacan tu foto" },
      { kind: "photoLiked", label: "Les gusta tu foto" },
      { kind: "photoCommented", label: "Comentan tu foto" },
    ],
  },
  {
    title: "Momento del día",
    footer: "Un aviso al día, a una hora al azar, para sacar tu foto; y otro cuando alguien del rollo sube la suya.",
    kinds: [
      { kind: "dailyMoment", label: "Momento del día" },
      { kind: "momentPosted", label: "Momentos del grupo" },
    ],
  },
];

/** Ajustes → Notificaciones: switches grouped by kind of push, and what to do if iOS doesn't let them through. */
export function NotificationSettingsScreen() {
  const { settings, loadError, refetch, isRefetching, saveError, set } = useNotificationSettings();

  return (
    <Screen grouped>
      <PermissionBanner />
      {settings ? (
        GROUPS.map(({ title, footer, kinds }) => (
          <Fragment key={title}>
            <Section title={title} footer={footer}>
              {kinds.map(({ kind, label }) => (
                <SwitchRow key={kind} label={label} value={settings[kind]} onValueChange={(v) => void set(kind, v)} />
              ))}
            </Section>
            {saveError && kinds.some((k) => k.kind === saveError.kind) && <ErrorText>{saveError.message}</ErrorText>}
          </Fragment>
        ))
      ) : loadError ? (
        <View style={styles.error}>
          <ErrorText>{loadError}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
        </View>
      ) : (
        <ActivityIndicator style={styles.loading} />
      )}
    </Screen>
  );
}

/** Only when iOS won't show them: never asked → ask; denied → only iOS Settings can turn them on. */
function PermissionBanner() {
  const { permission, enable } = usePushPermission();
  const [asking, setAsking] = useState(false);
  if (permission === null || permission === "granted") return null;

  async function activate() {
    setAsking(true);
    try {
      await enable();
    } finally {
      setAsking(false);
    }
  }

  return (
    <Section
      title="Las notificaciones están desactivadas"
      footer="Vas a ver estos ajustes, pero los avisos no van a llegar hasta que las actives."
    >
      {permission === "denied" ? (
        <Row label="Abrir Ajustes de iOS" tone="tint" chevron={false} onPress={() => void Linking.openSettings()} />
      ) : (
        <Row label="Activar notificaciones" tone="tint" chevron={false} loading={asking} onPress={asking ? undefined : () => void activate()} />
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  error: { gap: spacing.md },
  loading: { marginTop: spacing.xl },
});
