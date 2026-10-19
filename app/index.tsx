import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { listTrips, type TripSummary } from "@/storage/trips";
import { Body, Button, Card, Screen, Title } from "@/ui/components";

export default function HomeScreen() {
  const [trips, setTrips] = useState<TripSummary[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      listTrips().then(setTrips);
    }, []),
  );

  return (
    <Screen>
      <Title>Tus rollos</Title>

      {trips?.length === 0 && (
        <Body muted>Todavía no estás en ningún viaje</Body>
      )}

      {trips?.map((trip) => (
        <Card key={trip.tripId} label={trip.tripName} onPress={() => router.push(`/trip/${trip.tripId}`)}>
          <Body>{trip.tripName}</Body>
          <Body muted>{trip.role === "admin" ? "Lo creaste vos" : `Entraste como ${trip.memberName}`}</Body>
        </Card>
      ))}

      <Button label="Crear un viaje" onPress={() => router.push("/create")} />
      <Button label="Unirme con un código" variant="secondary" onPress={() => router.push("/join")} />
    </Screen>
  );
}
