import { router } from "expo-router";
import { ProfileHeader } from "@/features/profile/profile-header";
import { ProfileShowcase } from "@/features/profile/profile-showcase";
import { useUser } from "@/features/profile/use-user";
import { Button, ErrorText, Loading, Screen } from "@/ui/components";
import { FriendSections } from "./friend-sections";

/**
 * Anyone's profile: name, @, photo, description and friend count always (the navigation bar has no
 * title: the name is in the header); their featured photos if you may see them (a friend, or a public
 * profile), "Este perfil es privado" if not; and, for a friend, the rolls in common, "Sumar a un rollo"
 * and "Borrar amigo".
 */
export function UserProfileScreen({ userId }: { userId: string }) {
  const { profile, error, refetch, isRefetching } = useUser(userId);

  if (!profile) {
    return (
      <Screen grouped>
        {error ? (
          <>
            <ErrorText>{error}</ErrorText>
            <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
          </>
        ) : (
          <Loading />
        )}
      </Screen>
    );
  }

  const { user, isFriend, canSee, friendCount, mutualCount } = profile;
  return (
    <Screen grouped>
      <ProfileHeader
        id={user.id}
        name={user.name}
        username={user.username}
        avatarUrl={user.avatarUrl}
        bio={user.bio}
        friends={{ count: friendCount, mutual: mutualCount, canSee, onPress: () => router.push(`/user/${userId}/friends`) }}
      />
      <ProfileShowcase own={false} userId={userId} canSee={canSee} />
      {isFriend && <FriendSections userId={userId} name={user.name} />}
    </Screen>
  );
}
