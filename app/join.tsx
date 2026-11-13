import { useLocalSearchParams } from "expo-router";
import { JoinRoute as JoinLinkGate } from "@/features/events/join-route";

/** `/join` (the "Unirme" modal), optionally with `?code=` from a join link (`rollo://join/<CODE>`, Universal Link mapped by `+native-intent`). */
export default function JoinRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <JoinLinkGate code={code} />;
}
