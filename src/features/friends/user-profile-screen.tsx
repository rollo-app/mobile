import { router, Stack } from "expo-router";
import { useMe } from "@/features/auth/use-me";
import { ProfileMenu } from "@/features/moderation/profile-menu";
import { useBlock } from "@/features/moderation/use-block";
import { ProfileHeader } from "@/features/profile/profile-header";
import { ProfileShowcase } from "@/features/profile/profile-showcase";
import { useUser } from "@/features/profile/use-user";
import { Button, ErrorText, Footnote, Loading, Row, Screen, Section } from "@/ui/components";
import { FriendRequestButton } from "./friend-request-button";
import { friendRequestUi } from "./friend-request";
import { FriendSections } from "./friend-sections";

/**
 * Anyone's profile: name, @, photo, description and friend count always (the navigation bar has no
 * title: the name is in the header); their featured photos if you may see them (a friend, or a public
 * profile), "Este perfil es privado" if not; and, for a friend, the rolls in common, "Sumar a un rollo"
 * and "Borrar amigo".
 */
export function UserProfileScreen({ userId }: { userId: string }) {
  const { profile, error, refetch, isRefetching } = useUser(userId);
  const { me } = useMe();
  const block = useBlock(userId, profile?.user.name ?? "");

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

  const { user, isFriend, canSee, friendCount, mutualCount, blockedByMe, reportedByMe, friendRequest } = profile;
  const requestUi = friendRequestUi({ isFriend, isMe: me?.id === userId, blockedByMe, friendRequest });
  return (
    <Screen grouped>
      {me && me.id !== userId && (
        <Stack.Screen
          options={{
            headerRight: () => <ProfileMenu userId={userId} name={user.name} reported={reportedByMe} blocked={blockedByMe} />,
          }}
        />
      )}
      <ProfileHeader
        id={user.id}
        name={user.name}
        username={user.username}
        avatarUrl={user.avatarUrl}
        bio={user.bio}
        badge={user.badge}
        friends={{ count: friendCount, mutual: mutualCount, canSee, onPress: () => router.push(`/user/${userId}/friends`) }}
      />
      {requestUi && <FriendRequestButton userId={userId} state={requestUi} />}
      {reportedByMe && <Footnote>Denunciaste a esta persona</Footnote>}
      {blockedByMe ? (
        <Section>
          <Row label="Desbloquear" chevron={false} loading={block.busy} onPress={block.busy ? undefined : () => void block.unblock()} />
        </Section>
      ) : (
        <>
          <ProfileShowcase own={false} userId={userId} canSee={canSee} />
          {isFriend && <FriendSections userId={userId} name={user.name} />}
        </>
      )}
    </Screen>
  );
}
