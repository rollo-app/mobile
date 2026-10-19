import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { fetchTrip, type TripDetail } from "@/features/trips/actions";
import { Body, Button, Card, ErrorText, Loading, Screen, Title } from "@/ui/components";
import { spacing, useTheme } from "@/ui/theme";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchTrip(id)
      .then((d) => active && setDetail(d))
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : "No se pudo cargar el viaje"));
    return () => {
      active = false;
    };
  }, [id]);

  if (error) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  }
  if (!detail) return <Loading />;

  const { trip, members, today, totalUploaded } = detail;

  const share = () =>
    Share.share({ message: `Sumate a "${trip.name}" en Rollo con el código ${trip.joinCode}` });

  return (
    <Screen>
      <Stack.Screen options={{ title: trip.name }} />
      <Title>{trip.name}</Title>
      <Body muted>{plural(totalUploaded, "en el rollo", "en el rollo")}</Body>

      <Card>
        <Body muted>Código para invitar</Body>
        <Text style={[styles.code, { color: theme.text }]} selectable>
          {trip.joinCode}
        </Text>
        <Button label="Compartir código" variant="secondary" onPress={share} />
      </Card>

      <Card>
        <Body>{`Hoy te quedan ${plural(today.photosLeft, "foto", "fotos")} y ${plural(today.videosLeft, "video", "videos")}`}</Body>
      </Card>

      <View style={styles.members}>
        <Body muted>{plural(members.length, "persona", "personas")} en el viaje</Body>
        {members.map((m) => (
          <Body key={m.id}>{m.name}</Body>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 36, fontWeight: "700", letterSpacing: 6, fontVariant: ["tabular-nums"] },
  members: { gap: spacing.xs },
});
