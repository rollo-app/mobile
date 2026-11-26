import { useLocalSearchParams } from "expo-router";
import { SharePickScreen } from "@/features/share/share-pick-screen";

/** "Elegir fotos": choose and order the photos of the Stories collage. */
export default function SharePickRoute() {
  const { tripId, seed: seedParam, kind } = useLocalSearchParams<{ tripId: string; seed?: string; kind?: string }>();
  const seed = seedParam === undefined || seedParam === "" || Number.isNaN(Number(seedParam)) ? undefined : Number(seedParam);
  return <SharePickScreen tripId={tripId} seed={seed} kind={kind === "journey" ? "journey" : "collage"} />;
}
