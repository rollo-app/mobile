import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { startEmailLogin } from "@/features/auth/actions";
import { isValidEmail } from "@/features/auth/email";
import { Button, ErrorText, Field } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";

export default function EmailScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      await startEmailLogin(email);
      router.push({ pathname: "/code", params: { email: email.trim().toLowerCase() } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el código");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.screen, { paddingTop: insets.top + spacing.xl * 2, paddingBottom: insets.bottom + spacing.lg }]}
    >
      <View style={styles.copy}>
        <Text style={[type.largeTitle, { color: colors.label }]}>Rollo</Text>
        <Text style={[type.body, { color: colors.secondaryLabel }]}>
          Cada uno saca fotos y nadie las ve hasta el revelado, ni las propias.
        </Text>
      </View>
      <View style={styles.actions}>
        <Field
          label="Tu email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="go"
          onSubmitEditing={isValidEmail(email) ? submit : undefined}
          placeholder="nombre@email.com"
        />
        {error && <ErrorText>{error}</ErrorText>}
        <Button label="Continuar" onPress={submit} disabled={!isValidEmail(email)} loading={loading} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "space-between", padding: spacing.lg, backgroundColor: colors.background },
  copy: { gap: spacing.sm },
  actions: { gap: spacing.md },
});
