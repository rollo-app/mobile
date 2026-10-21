import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert } from "react-native";
import { Avatar } from "@/features/profile/avatar";
import { formatHandle } from "@/features/profile/username";
import { Button, ErrorText, Footnote, Loading, Row, Screen, Section } from "@/ui/components";
import { removeFriend, type Friend } from "./actions";
import { InviteFriend } from "./invite-friend";
import { friendsKey, useFriends } from "./use-friends";

/** Your friends (photo, name, handle) and the way to invite more. */
export function FriendsScreen() {
  const queryClient = useQueryClient();
  const { friends, error, refetch, isRefetching } = useFriends();
  const [removeError, setRemoveError] = useState<string | null>(null);

  function confirmRemove(friend: Friend) {
    Alert.alert(`¿Borrar a ${friend.name} de tus amigos?`, "Ya no vas a poder sumarlo a rollos. Los rollos en los que ya está no cambian.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar amigo", style: "destructive", onPress: () => void remove(friend) },
    ]);
  }

  async function remove(friend: Friend) {
    setRemoveError(null);
    const before = queryClient.getQueryData<Friend[]>(friendsKey);
    queryClient.setQueryData<Friend[]>(friendsKey, (current) => current?.filter((f) => f.id !== friend.id));
    try {
      await removeFriend(friend.id);
    } catch (e) {
      queryClient.setQueryData(friendsKey, before);
      setRemoveError(e instanceof Error ? e.message : "No se pudo borrar al amigo");
    }
  }

  return (
    <Screen grouped>
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
              onPress={() => confirmRemove(f)}
            />
          ))}
        </Section>
      )}
      {removeError && <ErrorText>{removeError}</ErrorText>}
    </Screen>
  );
}
