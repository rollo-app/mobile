import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { gateFor } from "@/features/auth/gate";
import { useMe } from "@/features/auth/use-me";
import { Button, ErrorText, Loading } from "@/ui/components";
import { colors, spacing } from "@/ui/theme";
import { openFriendLink } from "./handle-friend-link";

/**
 * `rollo://friends/<code>`: opens a friend link. With a ready account the friendship is made and the list
 * opens; without one the permission is kept and the sign-up goes on. A dead link is explained here.
 */
export function FriendLinkScreen({ code }: { code: string }) {
  const { session, me, failed } = useMe();
  const accountReady = gateFor({ session, me, meFailed: failed }) === "app";
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    openFriendLink(code, accountReady)
      .then((outcome) => {
        router.replace(outcome === "friends" ? "/friends" : "/");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo abrir el link"));
    // The link is opened once, with the account state it arrived with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!error) return <Loading />;
  return (
    <View style={styles.error}>
      <ErrorText>{error}</ErrorText>
      <Button label="Seguir" variant="secondary" onPress={() => router.replace("/")} />
    </View>
  );
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: "center", gap: spacing.md, padding: spacing.lg, backgroundColor: colors.background },
});
