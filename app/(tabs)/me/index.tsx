import { router, Stack } from "expo-router";
import { useMe } from "@/features/auth/use-me";
import { ProfileHeader } from "@/features/profile/profile-header";
import { ProfileShowcase } from "@/features/profile/profile-showcase";
import { Screen } from "@/ui/components";

/** Perfil: what the others see of you. The account settings live behind the gear (Ajustes). */
export default function MeScreen() {
  const { me } = useMe();
  return (
    <Screen grouped>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="gearshape" accessibilityLabel="Ajustes" onPress={() => router.push("/settings")} />
      </Stack.Toolbar>
      {me && (
        <>
          <ProfileHeader id={me.id} name={me.name ?? ""} username={me.username} avatarUrl={me.avatarUrl} bio={me.bio} />
          <ProfileShowcase own userId={me.id} canSee />
        </>
      )}
    </Screen>
  );
}
