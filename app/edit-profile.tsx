import { router } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { useMe } from "@/features/auth/use-me";
import { ProfileForm } from "@/features/profile/profile-form";
import { colors, spacing } from "@/ui/theme";

/** Edit your photo, name, username and description (sheet). */
export default function EditProfileScreen() {
  const { me } = useMe();
  if (!me) return null;
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.groupedBackground }}
      contentContainerStyle={styles.screen}
    >
      <ProfileForm user={me} showEmail showBio submitLabel="Guardar" onSaved={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: spacing.lg, paddingTop: spacing.xl },
});
