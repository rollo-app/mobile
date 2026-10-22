import { Stack } from "expo-router";
import { ProfileHeader } from "@/features/profile/profile-header";
import { ProfileShowcase } from "@/features/profile/profile-showcase";
import { useUser } from "@/features/profile/use-user";
import { Button, ErrorText, Loading, Screen } from "@/ui/components";
import { FriendSections } from "./friend-sections";

/**
 * Anyone's profile: name, @ and photo always; their description and featured photos if you may see
 * them (a friend, or a public profile), "Este perfil es privado" if not; and, for a friend, the rolls
 * in common, "Sumar a un rollo" and "Borrar amigo".
 */
export function UserProfileScreen({ userId }: { userId: string }) {
  const { profile, error, refetch, isRefetching } = useUser(userId);
  const title = <Stack.Screen options={{ title: profile?.user.name ?? "" }} />;

  if (!profile) {
    return (
      <Screen grouped>
        {title}
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

  const { user, isFriend, canSee } = profile;
  return (
    <Screen grouped>
      {title}
      <ProfileHeader id={user.id} name={user.name} username={user.username} avatarUrl={user.avatarUrl} bio={canSee ? user.bio : null} />
      <ProfileShowcase own={false} userId={userId} canSee={canSee} />
      {isFriend && <FriendSections userId={userId} name={user.name} />}
    </Screen>
  );
}
