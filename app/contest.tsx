import { useLocalSearchParams } from "expo-router";
import { ContestScreen } from "@/features/contest/contest-screen";

/** The photo contest: vote, tie-break and result. Push urls use `?trip=<id>`; `tripId` works too. */
export default function ContestRoute() {
  const { trip, tripId } = useLocalSearchParams<{ trip?: string; tripId?: string }>();
  return <ContestScreen tripId={(trip ?? tripId)!} />;
}
