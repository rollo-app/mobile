import { useLocalSearchParams } from "expo-router";
import { UserFriendsScreen } from "@/features/friends/user-friends-screen";

/** Someone's friends (all, or only the ones in common), from the count on their profile. */
export default function UserFriendsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <UserFriendsScreen userId={id} />;
}
