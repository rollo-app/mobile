import { Stack } from "expo-router";
import { Avatar } from "@/features/profile/avatar";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { useUserFriends } from "@/features/profile/use-user-friends";
import { formatHandle } from "@/features/profile/username";
import { Button, ErrorText, Footnote, Loading, Row, Screen, Section } from "@/ui/components";

/**
 * Someone's friends: all of them if you may see their profile, else only the ones you have in common
 * (titled "Amigos en común", with why). Tapping one opens their profile (yours is the Perfil tab).
 */
export function UserFriendsScreen({ userId }: { userId: string }) {
  const { data, error, refetch, isRefetching } = useUserFriends(userId);
  const openProfile = useOpenProfile();
  const mutual = data?.scope === "mutual";

  return (
    <Screen grouped>
      <Stack.Screen options={{ title: mutual ? "Amigos en común" : "Amigos" }} />
      {error && (
        <>
          <ErrorText>{error}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
        </>
      )}
      {!error && !data && <Loading />}
      {data && data.friends.length === 0 && <Footnote>{mutual ? "No tienen amigos en común." : "Todavía no tiene amigos."}</Footnote>}
      {data && data.friends.length > 0 && (
        <Section footer={mutual ? "Su perfil es privado: solo ves los amigos que tienen en común." : undefined}>
          {data.friends.map((f) => (
            <Row
              key={f.id}
              leading={<Avatar id={f.id} name={f.name} avatarUrl={f.avatarUrl} size={40} />}
              label={f.name}
              detail={f.username ? formatHandle(f.username) : undefined}
              onPress={() => openProfile(f.id)}
            />
          ))}
        </Section>
      )}
    </Screen>
  );
}
