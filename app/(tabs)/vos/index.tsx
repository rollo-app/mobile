import { router } from "expo-router";
import { Share } from "react-native";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { ErrorText, Loading, Row, Screen, Section } from "@/ui/components";

export default function VosScreen() {
  const { trip, trips } = useActiveTrip();
  const { detail, error } = useTripDetail(trip?.tripId);

  const share = () =>
    detail &&
    Share.share({ message: `Sumate a "${detail.trip.name}" en Rollo con el código ${detail.trip.joinCode}` });

  return (
    <Screen grouped>
      {trip && (
        <Section>
          <Row
            label={trip.memberName}
            value={trip.role === "admin" ? "Admin" : undefined}
            onPress={() => router.push("/rename")}
          />
        </Section>
      )}

      {error && <ErrorText>{error}</ErrorText>}
      {!error && !detail && trip && <Loading />}

      {detail && (
        <>
          <Section title="Invitar" footer="Con este código se suman al viaje.">
            <Row label="Código" value={detail.trip.joinCode} />
            <Row label="Compartir invitación" onPress={share} />
          </Section>

          <Section title={`En el viaje · ${detail.members.length}`}>
            {detail.members.map((m) => (
              <Row key={m.id} label={m.name} value={m.role === "admin" ? "Admin" : undefined} />
            ))}
          </Section>
        </>
      )}

      <Section>
        <Row label="Tus viajes" value={String(trips.length)} onPress={() => router.push("/trips")} />
      </Section>
    </Screen>
  );
}
