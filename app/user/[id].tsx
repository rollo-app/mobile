import { useLocalSearchParams } from "expo-router";
import { UserProfileScreen } from "@/features/friends/user-profile-screen";

/** Someone's profile from outside Amigos (a roll's members, a photo's author), pushed on the root stack. */
export default function UserProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <UserProfileScreen userId={id} />;
}
