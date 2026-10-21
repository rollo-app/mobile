import { RollMap } from "@/features/map/roll-map";
import { NoRollYet } from "@/features/roll/no-roll-yet";
import { hasNoTrips } from "@/features/trips/active";
import { useActiveTrip } from "@/features/trips/use-active-trip";

export default function MapScreen() {
  const { trip, loaded } = useActiveTrip();
  if (hasNoTrips(loaded, trip)) return <NoRollYet />;
  return <RollMap />;
}
