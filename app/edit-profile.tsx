import { router } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { useMe } from "@/features/auth/use-me";
import { ProfileForm } from "@/features/profile/profile-form";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { colors, spacing } from "@/ui/theme";

/** Edit your photo and name (sheet). */
export default function EditProfileScreen() {
  const { me } = useMe();
  const { trip } = useActiveTrip();
  const { detail } = useTripDetail(trip?.id);
  if (!me) return null;
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.groupedBackground }}
      contentContainerStyle={styles.screen}
    >
      {/* Same color as the avatar in Perfil, which follows the member of the active roll. */}
      <ProfileForm user={me} colorId={detail?.me.id ?? me.id} submitLabel="Guardar" onSaved={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: spacing.lg, paddingTop: spacing.xl },
});
