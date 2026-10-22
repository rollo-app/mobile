import { useState } from "react";
import { router } from "expo-router";
import { Alert } from "react-native";
import { deleteAccount, logout } from "@/features/auth/actions";
import { triggerBackgroundUploadForTesting } from "@/features/capture/background-upload";
import { OfflineMapRow } from "@/features/map/offline-map-row";
import { ErrorText, Row, Screen, Section } from "@/ui/components";

/** Ajustes: the account and this phone (Editar perfil, offline map, sign out, delete account). */
export function SettingsScreen() {
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
      </Section>

      {__DEV__ && (
        <Section title="Desarrollo">
          <Row label="Probar subida en segundo plano" onPress={() => void triggerBackgroundUploadForTesting()} />
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
