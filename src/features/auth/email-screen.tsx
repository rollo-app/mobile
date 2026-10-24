import { router } from "expo-router";
import { useState } from "react";
import { errorMessage } from "@/api/client";
import { Button, ErrorText, Field } from "@/ui/components";
import { AuthScreen } from "./auth-screen";
import { isValidEmail } from "./email";
import { TermsNotice } from "./terms-notice";
import { useStartEmailLogin } from "./use-start-email-login";

/** `initialEmail` is prefilled when coming back from a dead magic link. */
export function EmailScreen({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const start = useStartEmailLogin();
  const error = errorMessage(start.error, "No se pudo enviar el código");

  function submit() {
    start.mutate(email, {
      onSuccess: () => router.push({ pathname: "/code", params: { email: email.trim().toLowerCase() } }),
    });
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
      <Button label="Continuar" onPress={submit} disabled={!isValidEmail(email)} loading={start.isPending} />
      <TermsNotice />
    </AuthScreen>
  );
}
