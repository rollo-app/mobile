import { Stack } from "expo-router";
import { TripSwitcher } from "@/features/trips/trip-switcher";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { Footnote, Screen } from "@/ui/components";

export default function MapScreen() {
  const { trip } = useActiveTrip();
  return (
    <Screen>
      {trip && <Stack.Screen options={{ headerTitle: () => <TripSwitcher name={trip.tripName} /> }} />}
      <Footnote>Acá vas a ver dónde sacó cada uno sus fotos, sin verlas.</Footnote>
    </Screen>
  );
}
