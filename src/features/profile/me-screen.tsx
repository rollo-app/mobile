import { router, Stack } from "expo-router";
import { useMe } from "@/features/auth/use-me";
import { useFeatured } from "@/features/featured/use-featured";
import { useFriends } from "@/features/friends/use-friends";
import { Screen } from "@/ui/components";
import { ownStats } from "./own-stats";
import { ProfileHeader } from "./profile-header";
import { ProfileShowcase } from "./profile-showcase";
import { useUser } from "./use-user";

/** Perfil: what the others see of you. The account settings live behind the gear (Ajustes). */
export function MeScreen() {
  const { me } = useMe();
  // Your friend count comes from your friend list (the Amigos tab's cache): it changes as soon as you add
  // or remove someone, without another request. Rolls come from your profile; the photo count from the
  // featured grid (the same query ProfileShowcase makes, so no extra request).
  const { friends } = useFriends();
  const { profile, error } = useUser(me?.id);
  const { photos } = useFeatured(me?.id);
  const s = ownStats({ friends: friends?.length, profile, featuredLength: photos?.length, profileFailed: !!error });
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
            stats={s && { ...s, onPressFriends: () => router.navigate("/friends") }}
          />
          <ProfileShowcase own userId={me.id} canSee />
        </>
      )}
    </Screen>
  );
}
