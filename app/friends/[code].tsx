import { useLocalSearchParams } from "expo-router";
import { FriendLinkScreen } from "@/features/friends/friend-link-screen";

/** Deep link `rollo://friends/<code>` or the Universal Link `https://rollo.juanifraga.com/friends#<CODE>` (mapped by `+native-intent`); reachable with or without a session. */
export default function FriendLinkRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <FriendLinkScreen code={code ?? ""} />;
}
