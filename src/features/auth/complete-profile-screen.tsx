import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorMessage } from "@/api/client";
import { takePendingGooglePhoto } from "@/features/auth/google-photo";
import { useLogOut } from "@/features/auth/use-log-out";
import { useMe } from "@/features/auth/use-me";
import { ProfileForm } from "@/features/profile/profile-form";
import { markAppIntroPending } from "@/storage/app-intro";
import { Button, ErrorText } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";

/** First step after the first login: photo (optional) and name (required). */
export function CompleteProfileScreen() {
  const insets = useSafeAreaInsets();
  const { me } = useMe();
  const logOut = useLogOut();
  // Taken once per mount: the Google photo of an account that just signed up with Google.
  const [googlePhoto] = useState(takePendingGooglePhoto);
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
        <ProfileForm user={me} submitLabel="Listo" askFriendCode defaultPhotoUrl={googlePhoto} beforeApply={() => markAppIntroPending().catch(() => {})} onSaved={() => {}} />
        {/* The way out of this step without killing the app: the server blocks everything else (428) until the profile is complete. */}
        <View style={styles.signOut}>
          <Button label="Cerrar sesión" variant="secondary" disabled={logOut.isPending} onPress={() => logOut.mutate(undefined, { onSuccess: () => router.replace("/welcome") })} />
          {logOut.error && <ErrorText>{errorMessage(logOut.error, "No se pudo cerrar sesión")}</ErrorText>}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: { flexGrow: 1, gap: spacing.xl, padding: spacing.lg },
  copy: { gap: spacing.sm },
  signOut: { gap: spacing.sm },
});
