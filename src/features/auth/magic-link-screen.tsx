import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/api/client";
import { Button, ErrorText, Loading } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { verifyMagicLink } from "./actions";
import { gateFor } from "./gate";
import { sameEmail, verifyMagicLinkOnce } from "./magic-link";
import { useMe } from "./use-me";

const INVALID = "Este link no es válido. Pedí un código nuevo desde la app.";

/**
 * `rollo://login?token=…&email=…`, from the email's button (via rollo.juanifraga.com/entrar). Without a
 * session it signs in like the code does and the gate takes over; with one it never switches accounts.
 */
export function MagicLinkScreen({ token, email }: { token: string; email: string }) {
  const { session, me, failed } = useMe();
  const gate = gateFor({ session, me, meFailed: failed });
  const [error, setError] = useState<string | null>(token && email ? null : INVALID);
  const goIn = () => router.replace("/");

  const signedOut = session === "out";
  useEffect(() => {
    if (!signedOut || !token || !email) return;
    let active = true;
    verifyMagicLinkOnce(email, token, verifyMagicLink).catch((e) => {
      if (active) setError(e instanceof ApiError ? e.message : "No pudimos entrar. Revisá tu conexión y pedí otro código.");
    });
    return () => {
      active = false;
    };
  }, [signedOut, token, email]);

  // Signed in (already, or by this link) with the link's account, or the account can't load: the gate decides.
  const ownAccount = !!me && sameEmail(me.email, email);
  const signedIn = session === "in" && (gate === "error" || ownAccount);
  useEffect(() => {
    if (signedIn) goIn();
  }, [signedIn]);

  if (session === "in" && me && !ownAccount) {
    return (
      <View style={styles.screen}>
        <Text style={[type.body, { color: colors.label }]}>Ya tenés la sesión iniciada con {me.email}.</Text>
        <Button label="Seguir con esta cuenta" onPress={goIn} />
      </View>
    );
  }

  if (error && session !== "in") {
    return (
      <View style={styles.screen}>
        <ErrorText>{error}</ErrorText>
        <Button
          label="Volver a pedir un código"
          variant="secondary"
          onPress={() => router.replace(email ? { pathname: "/email", params: { email: email.trim().toLowerCase() } } : "/email")}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Loading />
      <Text style={[type.body, styles.center, { color: colors.secondaryLabel }]}>Entrando…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", gap: spacing.md, padding: spacing.lg, backgroundColor: colors.background },
  center: { textAlign: "center" },
});
