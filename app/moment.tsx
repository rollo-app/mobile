import { useLocalSearchParams } from "expo-router";
import { MomentScreen } from "@/features/moments/moment-screen";

export default function MomentRoute() {
  const { trip, day, at, selfie } = useLocalSearchParams<{ trip?: string; day?: string; at?: string; selfie?: string }>();
  return <MomentScreen tripId={trip} day={day} at={at ? Number(at) : undefined} selfie={selfie} />;
}
