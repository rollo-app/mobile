import { useLocalSearchParams } from "expo-router";
import { PicksScreen } from "@/features/contest/picks-screen";

/** "Elegí las finalistas" (organizers). Push urls use `?trip=<id>`; `tripId` works too. */
export default function ContestPicksRoute() {
  const { trip, tripId } = useLocalSearchParams<{ trip?: string; tripId?: string }>();
  return <PicksScreen tripId={(trip ?? tripId)!} />;
}
