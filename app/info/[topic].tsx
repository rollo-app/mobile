import { useLocalSearchParams } from "expo-router";
import { InfoScreen } from "@/features/info/info-screen";

/** "i" explanation (form sheet): the topic comes from the route. */
export default function InfoRoute() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  return <InfoScreen topic={topic} />;
}
