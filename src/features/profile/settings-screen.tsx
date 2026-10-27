import { router } from "expo-router";
import { Alert } from "react-native";
import { useDeleteAccount } from "@/features/auth/use-delete-account";
import { useLogOut } from "@/features/auth/use-log-out";
import { errorMessage } from "@/api/client";
import { triggerBackgroundUploadForTesting } from "@/features/capture/background-upload";
import { InfoButton } from "@/features/info/info-button";
import { usePrivacySettings } from "@/features/featured/use-privacy-settings";
import { useBlocked } from "@/features/moderation/use-blocked";
import { OfflineMapRow } from "@/features/map/offline-map-row";
import { ErrorText, Row, Screen, Section, SwitchRow } from "@/ui/components";
import { DevMomentRows } from "./dev-moment-rows";
import { useProfileVisibility } from "./use-profile-visibility";

/** Ajustes: the account and this phone (Editar perfil, Notificaciones, who sees your profile, offline map, sign out, delete account). */
export function SettingsScreen() {
  const visibility = useProfileVisibility();
  const privacy = usePrivacySettings();
  const { blocked } = useBlocked();
  const logOut = useLogOut();
  const deleteAccount = useDeleteAccount();

  function confirmDelete() {
    Alert.alert(
      "¿Borrar tu cuenta?",
      "Se borran tu cuenta y todas tus fotos en todos los rollos, también en los ya revelados. No se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Borrar cuenta", style: "destructive", onPress: () => deleteAccount.mutate() },
      ],
    );
  }

  return (
    <Screen grouped>
      <Section>
        <Row label="Editar perfil" onPress={() => router.push("/edit-profile")} />
        <Row label="Notificaciones" onPress={() => router.push("/notifications")} />
      </Section>

      <Section footer="Si está apagado, solo tus amigos ven tus fotos destacadas y tu lista de amigos.">
        <SwitchRow label="Perfil público" labelAccessory={<InfoButton topic="publicProfile" />} value={visibility.isPublic} onValueChange={(v) => void visibility.setPublic(v)} />
      </Section>
      {visibility.error && <ErrorText>{visibility.error}</ErrorText>}

      <Section footer="Si lo apagás, nadie puede agregar tus fotos a su perfil. Las que ya están en un perfil se sacan. Vos siempre podés destacar las tuyas.">
        <SwitchRow
          label="Permitir que agreguen mis fotos a su perfil"
          labelAccessory={<InfoButton topic="othersProfiles" />}
          value={privacy.allowFeaturing} onValueChange={privacy.set} />
      </Section>
      {privacy.error && <ErrorText>{privacy.error}</ErrorText>}

      {__DEV__ && (
        <Section title="Desarrollo">
          <Row label="Probar subida en segundo plano" chevron={false} onPress={() => void triggerBackgroundUploadForTesting()} />
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
        <Row label="Cerrar sesión" chevron={false} loading={logOut.isPending} onPress={logOut.isPending ? undefined : () => logOut.mutate()} />
        <Row label="Borrar cuenta" tone="danger" chevron={false} loading={deleteAccount.isPending} onPress={deleteAccount.isPending ? undefined : confirmDelete} />
      </Section>
      {logOut.isError && <ErrorText>{errorMessage(logOut.error, "No se pudo cerrar la sesión")}</ErrorText>}
      {deleteAccount.isError && <ErrorText>{errorMessage(deleteAccount.error, "No se pudo borrar la cuenta")}</ErrorText>}
    </Screen>
  );
}
