import { router } from "expo-router";
import { useState } from "react";
import { startEmailLogin } from "@/features/auth/actions";
import { AuthScreen } from "@/features/auth/auth-screen";
import { isValidEmail } from "@/features/auth/email";
import { Button, ErrorText, Field } from "@/ui/components";

export default function EmailScreen() {
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
    <AuthScreen title="Rollo" subtitle="Cada uno saca fotos y nadie las ve hasta el revelado, ni las propias.">
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
    </AuthScreen>
  );
}

