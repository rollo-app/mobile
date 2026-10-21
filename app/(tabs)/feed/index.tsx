import { FeedList } from "@/features/feed/feed-list";
import { NoRollYet } from "@/features/roll/no-roll-yet";
import { hasNoTrips } from "@/features/trips/active";
import { useActiveTrip } from "@/features/trips/use-active-trip";

export default function FeedScreen() {
  const { trip, loaded } = useActiveTrip();
  if (hasNoTrips(loaded, trip)) return <NoRollYet />;
  return <FeedList />;
}
