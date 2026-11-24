import { hasNoTrips } from "@/features/trips/active";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { Loading } from "@/ui/components";
import { RollScreen } from "./roll-screen";
import { Welcome } from "./welcome";

/** Temporary until the Rollos list: the roll tab shows the active roll, or the welcome without rolls. */
export function ActiveRollScreen({ view }: { view?: string }) {
  const { trip, loaded } = useActiveTrip();
  if (hasNoTrips(loaded, trip)) return <Welcome />;
  // Until the saved active id is read, `trip` is only a guess: mounting the roll now would save that guess as active.
  if (!loaded || !trip) return <Loading />;
  return <RollScreen tripId={trip.id} view={view} />;
}
