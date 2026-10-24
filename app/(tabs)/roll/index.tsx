import { useLocalSearchParams } from "expo-router";
import { RollScreen } from "@/features/roll/roll-screen";

export default function RollRoute() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  return <RollScreen view={view} />;
}
