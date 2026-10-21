import { useState } from "react";
import { router } from "expo-router";
import { Alert, Share, StyleSheet, Text, View } from "react-native";
import { deleteAccount, logout } from "@/features/auth/actions";
import { useMe } from "@/features/auth/use-me";
import { UploadStatusSection } from "@/features/capture/upload-status-section";
import { triggerBackgroundUploadForTesting } from "@/features/capture/background-upload";
import { OfflineMapRow } from "@/features/map/offline-map-row";
import { Avatar } from "@/features/profile/avatar";
import { formatHandle } from "@/features/profile/username";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Loading, Row, Screen, Section } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";

export default function MeScreen() {
  const { me } = useMe();
  const { trip, trips } = useActiveTrip();
  const { detail, error, refetch, isRefetching } = useTripDetail(trip?.id);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const share = () =>
    detail &&
    Share.share({ message: `Sumate a "${detail.trip.name}" en Rollo con el código ${detail.trip.joinCode}` });

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
      {me && (
        <View style={styles.profile}>
          {/* The color is the membership id when we have it, so it matches the feed and the map. */}
          <Avatar id={detail?.me.id ?? me.id} name={me.name} avatarUrl={me.avatarUrl} size={72} />
          <Text style={[type.title, { color: colors.label }]}>{me.name}</Text>
          {me.username && <Text style={[type.subhead, { color: colors.secondaryLabel }]}>{formatHandle(me.username)}</Text>}
          <Text selectable style={[type.subhead, { color: colors.secondaryLabel }]}>
            {me.email}
          </Text>
        </View>
      )}
      <Section>
        <Row label="Editar perfil" onPress={() => router.push("/edit-profile")} />
      </Section>

      {trip && (
        <Section title="Rollo activo">
          <Row label={trip.name} value={trip.role === "admin" ? "Admin" : undefined} onPress={() => router.push("/trips")} />
        </Section>
      )}

      {error && (
        <>
          <ErrorText>{error}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
        </>
      )}
      {!error && !detail && trip && <Loading />}

      {detail && (
        <>
          <Section title="Invitar" footer="Con este código se suman al rollo.">
            <Row label="Código" value={detail.trip.joinCode} />
            <Row label="Compartir invitación" onPress={share} />
          </Section>

          <Section title={`En el rollo · ${detail.members.length}`}>
            {detail.members.map((m) => (
              <Row
                key={m.id}
                leading={<Avatar id={m.id} name={m.name} avatarUrl={m.avatarUrl} size={40} />}
                label={m.name}
                detail={m.username ? formatHandle(m.username) : undefined}
                value={m.role === "admin" ? "Admin" : undefined}
              />
            ))}
          </Section>
        </>
      )}

      {trip && (
        <UploadStatusSection
          tripId={trip.id}
          timeZone={detail?.trip.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
        />
      )}

      {trips.length > 0 && (
        <Section>
          <OfflineMapRow />
          <Row label="Tus rollos" value={String(trips.length)} onPress={() => router.push("/trips")} />
        </Section>
      )}

      {__DEV__ && (
        <Section title="Desarrollo">
          <Row label="Probar subida en segundo plano" onPress={() => void triggerBackgroundUploadForTesting()} />
        </Section>
      )}

      <Section>
        <Row label="Cerrar sesión" onPress={() => void logout()} />
        <Row label="Borrar cuenta" tone="danger" loading={deleting} onPress={deleting ? undefined : confirmDelete} />
      </Section>
      {accountError && <ErrorText>{accountError}</ErrorText>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.md },
});
