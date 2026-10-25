import { Fragment, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import { Button, ErrorText, Row, Screen, Section, SwitchRow } from "@/ui/components";
import { spacing } from "@/ui/theme";
import { useNotificationSettings, type NotificationKind } from "./use-notification-settings";
import { usePushPermission } from "./use-push-permission";

const KINDS: { kind: NotificationKind; label: string; footer: string }[] = [
  { kind: "addedToTrip", label: "Te suman a un rollo", footer: "Cuando alguien te agrega a un rollo." },
  { kind: "newFriend", label: "Nuevos amigos", footer: "Cuando alguien acepta tu link de amistad." },
  { kind: "tripStarted", label: "Arranca un rollo", footer: "Cuando empieza un rollo en el que estás." },
  { kind: "tripRevealed", label: "Se revela un rollo", footer: "Cuando se revelan las fotos de un rollo tuyo." },
  { kind: "photoFeatured", label: "Destacan tu foto", footer: "Cuando alguien pone una foto tuya en su perfil." },
  { kind: "photoLiked", label: "Les gusta tu foto", footer: "Cuando a alguien le gusta una foto tuya." },
  { kind: "photoCommented", label: "Comentan tu foto", footer: "Cuando alguien comenta una foto tuya o una que comentaste." },
];

/** Ajustes → Notificaciones: a switch per kind of push, and what to do if iOS doesn't let them through. */
export function NotificationSettingsScreen() {
  const { settings, loadError, refetch, isRefetching, saveError, set } = useNotificationSettings();

  return (
    <Screen grouped>
      <PermissionBanner />
      {settings ? (
        KINDS.map(({ kind, label, footer }) => (
          <Fragment key={kind}>
            <Section footer={footer}>
              <SwitchRow label={label} value={settings[kind]} onValueChange={(v) => void set(kind, v)} />
            </Section>
            {saveError?.kind === kind && <ErrorText>{saveError.message}</ErrorText>}
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
        <Row label="Abrir Ajustes de iOS" tone="tint" onPress={() => void Linking.openSettings()} />
      ) : (
        <Row label="Activar notificaciones" tone="tint" loading={asking} onPress={asking ? undefined : () => void activate()} />
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  error: { gap: spacing.md },
  loading: { marginTop: spacing.xl },
});
