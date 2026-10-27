import { router, Stack } from "expo-router";
import { useMe } from "@/features/auth/use-me";
import { useFriends } from "@/features/friends/use-friends";
import { ProfileHeader } from "@/features/profile/profile-header";
import { ProfileShowcase } from "@/features/profile/profile-showcase";
import { Screen } from "@/ui/components";

/** Perfil: what the others see of you. The account settings live behind the gear (Ajustes). */
export default function MeScreen() {
  const { me } = useMe();
  // Your own count comes from your friend list (the Amigos tab's cache): it changes as soon as you add
  // or remove someone, without another request.
  const { friends } = useFriends();
  return (
    <Screen grouped>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="clock.arrow.circlepath" accessibilityLabel="Tu actividad" onPress={() => router.push("/me/activity")} />
        <Stack.Toolbar.Button icon="gearshape" accessibilityLabel="Ajustes" onPress={() => router.push("/settings")} />
      </Stack.Toolbar>
      {me && (
        <>
          <ProfileHeader
            id={me.id}
            name={me.name ?? ""}
            username={me.username}
            avatarUrl={me.avatarUrl}
            bio={me.bio}
            badge={me.badge}
            friends={friends ? { count: friends.length, own: true, onPress: () => router.navigate("/friends") } : undefined}
          />
          <ProfileShowcase own userId={me.id} canSee />
        </>
      )}
    </Screen>
  );
}
