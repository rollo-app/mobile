import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { gateFor } from "@/features/auth/gate";
import { useMe } from "@/features/auth/use-me";
import { Button } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { friendLinkFailure, type FriendLinkFailure } from "./friend-link-failure";
import { openFriendLink } from "./handle-friend-link";

const COPY = {
  expired: {
    symbol: "clock.badge.xmark",
    title: "Este link ya no sirve",
    body: "Los links de amistad valen una hora. Pedile a quien te lo mandó que te pase uno nuevo.",
  },
  unavailable: {
    symbol: "wifi.exclamationmark",
    title: "No pudimos abrir el link",
    body: "Revisá tu conexión y probá de nuevo.",
  },
} as const;

/**
 * `rollo://friends/<code>` or `https://rollo.juanifraga.com/friends#<CODE>`: opens a friend link. With a ready account the friendship is made and the list
 * opens; without one the permission is kept and the sign-up goes on. A dead link, or one we couldn't open, is explained here.
 */
export function FriendLinkScreen({ code }: { code: string }) {
  const { session, me, failed } = useMe();
  const accountReady = gateFor({ session, me, meFailed: failed }) === "app";
  const started = useRef(false);
  const [failure, setFailure] = useState<FriendLinkFailure | null>(null);

  const open = () => {
    setFailure(null);
    openFriendLink(code, accountReady)
      .then((outcome) => {
        router.replace(outcome === "friends" ? "/friends" : "/");
      })
      .catch((e) => setFailure(friendLinkFailure(e)));
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // The link is opened once, with the account state it arrived with.
    open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!failure) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.opening}>Abriendo el link…</Text>
      </View>
    );
  }

  const copy = COPY[failure];
  const home = () => router.replace("/");
  return (
    <View style={styles.center}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <SymbolView name={copy.symbol} size={56} tintColor={colors.tertiaryLabel} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {copy.title}
      </Text>
      <Text style={styles.body}>{copy.body}</Text>
      <View style={styles.actions}>
        {failure === "unavailable" ? (
          <>
            <Button label="Reintentar" onPress={open} />
            <Button label="Ir a Rollo" variant="secondary" onPress={home} />
          </>
        ) : (
          <Button label="Ir a Rollo" onPress={home} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  opening: { ...type.subhead, color: colors.secondaryLabel },
  title: { ...type.title, color: colors.label, textAlign: "center" },
  body: { ...type.body, color: colors.secondaryLabel, textAlign: "center" },
  actions: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.md },
});
