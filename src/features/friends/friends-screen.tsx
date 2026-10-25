import { router } from "expo-router";
import { Avatar } from "@/features/profile/avatar";
import { formatHandle } from "@/features/profile/username";
import { Button, ErrorText, Footnote, Loading, Row, Screen, Section } from "@/ui/components";
import { FriendRequestsRow } from "./friend-requests-row";
import { InviteFriend } from "./invite-friend";
import { useFriends } from "./use-friends";

/** Your friends (photo, name, handle) and the way to invite more. Tapping one opens their profile. */
export function FriendsScreen() {
  const { friends, error, refetch, isRefetching } = useFriends();

  return (
    <Screen grouped>
      <FriendRequestsRow />
      <InviteFriend />

      {error && (
        <>
          <ErrorText>{error}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
        </>
      )}
      {!error && !friends && <Loading />}
      {friends && friends.length === 0 && <Footnote>Todavía no tenés amigos. Invitá a alguien con el link y va a aparecer acá.</Footnote>}
      {friends && friends.length > 0 && (
        <Section title={`Amigos · ${friends.length}`}>
          {friends.map((f) => (
            <Row
              key={f.id}
              leading={<Avatar id={f.id} name={f.name} avatarUrl={f.avatarUrl} size={40} />}
              label={f.name}
              detail={f.username ? formatHandle(f.username) : undefined}
              onPress={() => router.push(`/friends/user/${f.id}`)}
            />
          ))}
        </Section>
      )}
    </Screen>
  );
}
