import { useLocalSearchParams } from "expo-router";
import { FriendProfileScreen } from "@/features/friends/friend-profile-screen";

/** A friend's profile, inside the Amigos tab. */
export default function FriendProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FriendProfileScreen userId={id} />;
}
