import { useLocalSearchParams } from "expo-router";
import { ActiveRollScreen } from "@/features/roll/active-roll-screen";

export default function RollRoute() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  return <ActiveRollScreen view={view} />;
}
