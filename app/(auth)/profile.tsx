import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMe } from "@/features/auth/use-me";
import { ProfileForm } from "@/features/profile/profile-form";
import { markAppIntroPending } from "@/storage/app-intro";
import { colors, spacing, type } from "@/ui/theme";

/** First step after the first login: photo (optional) and name (required). */
export default function CompleteProfileScreen() {
  const insets = useSafeAreaInsets();
  const { me } = useMe();
  if (!me) return null;

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.fill}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.screen, { paddingTop: insets.top + spacing.xl * 2, paddingBottom: insets.bottom + spacing.lg }]}
      >
        <View style={styles.copy}>
          <Text style={[type.largeTitle, { color: colors.label }]}>Completá tu perfil</Text>
          <Text style={[type.body, { color: colors.secondaryLabel }]}>Así te ve el resto del rollo.</Text>
        </View>
        {/* Saving the name flips the gate: the app opens on its own; the intro is queued first so the tabs find it. */}
        <ProfileForm user={me} submitLabel="Listo" askFriendCode beforeApply={() => markAppIntroPending().catch(() => {})} onSaved={() => {}} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: { flexGrow: 1, gap: spacing.xl, padding: spacing.lg },
  copy: { gap: spacing.sm },
});
