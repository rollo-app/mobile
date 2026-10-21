import { useLocalSearchParams } from "expo-router";
import { FriendLinkScreen } from "@/features/friends/friend-link-screen";

/** Deep link `rollo://amigos/<code>`; reachable with or without a session. */
export default function FriendLinkRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <FriendLinkScreen code={code ?? ""} />;
}
