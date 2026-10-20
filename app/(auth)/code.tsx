import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { startEmailLogin, verifyCode } from "@/features/auth/actions";
import { resendSecondsLeft } from "@/features/auth/resend";
import { Button, ErrorText, Field } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";

export default function CodeScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const wait = resendSecondsLeft(sentAt, now);

  async function submit(value: string) {
    setError(null);
    setLoading(true);
    try {
      // The session flips the gate on its own: new accounts land on "Completá tu perfil", the rest in the app.
      await verifyCode(email, value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo verificar el código");
    } finally {
      setLoading(false);
    }
  }

  function change(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6 && !loading) void submit(digits);
  }

  async function resend() {
    setError(null);
    setResending(true);
    try {
      await startEmailLogin(email);
      setSentAt(Date.now());
      setNow(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reenviar el código");
    } finally {
      setResending(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.screen, { paddingTop: insets.top + spacing.xl * 2, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.copy}>
        <Text style={[type.largeTitle, { color: colors.label }]}>Revisá tu mail</Text>
        <Text style={[type.body, { color: colors.secondaryLabel }]}>Te mandamos un código de 6 dígitos a {email}.</Text>
      </View>
      <View style={styles.actions}>
        <Field
          label="Código"
          value={code}
          onChangeText={change}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          placeholder="123456"
        />
        {error && <ErrorText>{error}</ErrorText>}
        <Button label="Entrar" onPress={() => void submit(code)} disabled={code.length !== 6} loading={loading} />
        <Button
          label={wait > 0 ? `Reenviar código (${wait} s)` : "Reenviar código"}
          variant="secondary"
          onPress={resend}
          disabled={wait > 0}
          loading={resending}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "space-between", padding: spacing.lg, backgroundColor: colors.background },
  copy: { gap: spacing.sm },
  actions: { gap: spacing.md },
});
