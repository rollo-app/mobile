import { useState } from "react";
import { router } from "expo-router";
import { Alert } from "react-native";
import { deleteAccount, logout } from "@/features/auth/actions";
import { triggerBackgroundUploadForTesting } from "@/features/capture/background-upload";
import { useBlocked } from "@/features/moderation/use-blocked";
import { OfflineMapRow } from "@/features/map/offline-map-row";
import { ErrorText, Row, Screen, Section, SwitchRow } from "@/ui/components";
import { DevMomentRows } from "./dev-moment-rows";
import { useProfileVisibility } from "./use-profile-visibility";

/** Ajustes: the account and this phone (Editar perfil, Notificaciones, who sees your profile, offline map, sign out, delete account). */
export function SettingsScreen() {
  const visibility = useProfileVisibility();
  const { blocked } = useBlocked();
  const [accountError, setAccountError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function confirmDelete() {
    Alert.alert(
      "¿Borrar tu cuenta?",
      "Se borran tu cuenta y todas tus fotos en todos los rollos, también en los ya revelados. No se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Borrar cuenta", style: "destructive", onPress: () => void remove() },
      ],
    );
  }

  async function remove() {
    setAccountError(null);
    setDeleting(true);
    try {
      await deleteAccount();
    } catch (e) {
      setAccountError(e instanceof Error ? e.message : "No se pudo borrar la cuenta");
      setDeleting(false);
    }
  }

  return (
    <Screen grouped>
      <Section>
        <Row label="Editar perfil" onPress={() => router.push("/edit-profile")} />
        <Row label="Notificaciones" onPress={() => router.push("/notifications")} />
      </Section>

      <Section footer="Si está apagado, solo tus amigos ven tus fotos destacadas y tu lista de amigos.">
        <SwitchRow label="Perfil público" value={visibility.isPublic} onValueChange={(v) => void visibility.setPublic(v)} />
      </Section>
      {visibility.error && <ErrorText>{visibility.error}</ErrorText>}

      {__DEV__ && (
        <Section title="Desarrollo">
          <Row label="Probar subida en segundo plano" onPress={() => void triggerBackgroundUploadForTesting()} />
          <DevMomentRows />
        </Section>
      )}

      {!!blocked?.length && (
        <Section>
          <Row label="Bloqueados" onPress={() => router.push("/blocked")} />
        </Section>
      )}

      <Section>
        <OfflineMapRow />
      </Section>

      <Section>
        <Row label="Cerrar sesión" onPress={() => void logout()} />
        <Row label="Borrar cuenta" tone="danger" loading={deleting} onPress={deleting ? undefined : confirmDelete} />
      </Section>
      {accountError && <ErrorText>{accountError}</ErrorText>}
    </Screen>
  );
}
