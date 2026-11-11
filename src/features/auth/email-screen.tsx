import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useState } from "react";
import { useColorScheme, View } from "react-native";
import { errorMessage } from "@/api/client";
import { Button, ErrorText, Field } from "@/ui/components";
import { AuthScreen } from "./auth-screen";
import { GoogleSignInButton } from "./google-button";
import { isValidEmail } from "./email";
import { TermsNotice } from "./terms-notice";
import { useAppleSignIn, useAppleSignInAvailable } from "./use-apple-sign-in";
import { useGoogleSignIn } from "./use-google-sign-in";
import { useStartEmailLogin } from "./use-start-email-login";

/** Same height and fully rounded corners as `Button`. */
const APPLE_BUTTON_HEIGHT = 50;

/** `initialEmail` is prefilled when coming back from a dead magic link. */
export function EmailScreen({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const scheme = useColorScheme();
  const start = useStartEmailLogin();
  const google = useGoogleSignIn();
  const apple = useAppleSignIn();
  const appleAvailable = useAppleSignInAvailable();
  const busy = start.isPending || google.isPending || apple.isPending;
  // One error at a time: starting any of the three resets the others.
  const error =
    errorMessage(start.error, "No se pudo enviar el código") ??
    errorMessage(google.error, "No se pudo entrar con Google") ??
    errorMessage(apple.error, "No se pudo entrar con Apple");
  const resetAll = () => {
    start.reset();
    google.reset();
    apple.reset();
  };

  function submit() {
    resetAll();
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
      {/* Apple's own button (its guidelines: at least as prominent as any other sign-in option), so it goes before Google. */}
      {appleAvailable && (
        <View pointerEvents={busy ? "none" : "auto"} style={{ opacity: busy && !apple.isPending ? 0.4 : 1 }}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={scheme === "dark" ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={APPLE_BUTTON_HEIGHT / 2}
            style={{ height: APPLE_BUTTON_HEIGHT }}
            onPress={() => {
              resetAll();
              // The session flips the gate on its own, as with the code.
              apple.mutate();
            }}
          />
        </View>
      )}
      <GoogleSignInButton
        onPress={() => {
          resetAll();
          google.mutate();
        }}
        disabled={start.isPending || apple.isPending}
        loading={google.isPending}
      />
      <TermsNotice />
    </AuthScreen>
  );
}
