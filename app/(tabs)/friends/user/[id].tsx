import { useLocalSearchParams } from "expo-router";
import { UserProfileScreen } from "@/features/friends/user-profile-screen";

/** Someone's profile, inside the Amigos tab (a friend from the list). */
export default function FriendProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <UserProfileScreen userId={id} />;
}
