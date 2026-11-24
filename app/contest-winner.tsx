import { useLocalSearchParams } from "expo-router";
import { WinnerRevealScreen } from "@/features/contest/winner-reveal-screen";

/** The photo contest's winner reveal, once per event (`useWinnerReveal` opens it with `?trip=<id>`; `tripId` works too). */
export default function ContestWinnerRoute() {
  const { trip, tripId } = useLocalSearchParams<{ trip?: string; tripId?: string }>();
  return <WinnerRevealScreen tripId={(trip ?? tripId)!} />;
}
