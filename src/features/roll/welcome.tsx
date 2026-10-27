import { router } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useState } from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { useMe } from "@/features/auth/use-me";
import { Avatar } from "@/features/profile/avatar";
import { formatHandle } from "@/features/profile/username";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { hasSeenWelcomeIntro, markWelcomeIntroSeen } from "@/storage/welcome-intro";
import { Button, ErrorText } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { useReduceMotion } from "@/ui/use-reduce-motion";
import { welcomeMark, type WelcomeMark } from "./welcome-mark";

const MARK_SIZE = 96;

/**
 * Rollo's logo above the title. The first time ever on this phone it animates in; after that it's its last frame.
 * Decorative: the title already says it.
 */
function Mark() {
  const dark = useColorScheme() === "dark";
  const reduceMotion = useReduceMotion();
  // null while the flag is read; a failed read counts as seen (no animation).
  const [seen, setSeen] = useState<boolean | null>(null);
  // Latched once decided: marking it seen must not turn a playing intro into a still one.
  const [mode, setMode] = useState<WelcomeMark>("wait");

  useEffect(() => {
    let active = true;
    hasSeenWelcomeIntro()
      .then((v) => active && setSeen(v))
      .catch(() => active && setSeen(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (mode !== "wait") return;
    const next = welcomeMark(seen, reduceMotion);
    if (next === "wait") return;
    setMode(next);
    if (seen === false) markWelcomeIntroSeen().catch(() => {});
  }, [mode, seen, reduceMotion]);

  if (mode === "wait") return <View style={styles.mark} accessible={false} />;
  return (
    <View style={styles.mark} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <LottieView
        source={
          dark ? require("../../../assets/lottie/logo-intro-dark.json") : require("../../../assets/lottie/logo-intro-light.json")
        }
        style={styles.mark}
        autoPlay={mode === "play"}
        loop={false}
        progress={mode === "play" ? undefined : 1}
      />
    </View>
  );
}

/** The Rollo tab for someone who is in no roll yet: who they are and the two ways in. */
export function Welcome() {
  const { me } = useMe();
  const { error } = useActiveTrip();

  // Fixed content, not a scroll view: there's nothing to scroll and the header inset would add empty space.
  return (
    <View style={styles.content}>
      {me && (
        <View style={styles.who}>
          <Avatar id={me.id} name={me.name} avatarUrl={me.avatarUrl} size={72} />
          <Text style={[type.headline, { color: colors.label }]}>{me.name}</Text>
          {me.username && <Text style={[type.subhead, { color: colors.secondaryLabel }]}>{formatHandle(me.username)}</Text>}
        </View>
      )}
      <View style={styles.copy}>
        <Mark />
        <Text style={[type.title, styles.center, { color: colors.label }]}>Todavía no tenés rollos</Text>
        <Text style={[type.body, styles.center, { color: colors.secondaryLabel }]}>
          Empezá uno con tus amigos o sumate con un código.
        </Text>
      </View>
      <View style={styles.actions}>
        {error && <ErrorText>{error}</ErrorText>}
        <Button label="Empezar un nuevo rollo" onPress={() => router.push("/create")} />
        <Button label="Sumarme con un código" variant="secondary" onPress={() => router.push("/join")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: "center", gap: spacing.xl, padding: spacing.lg, backgroundColor: colors.background },
  who: { alignItems: "center", gap: spacing.xs },
  copy: { gap: spacing.sm, alignItems: "center" },
  mark: { width: MARK_SIZE, height: MARK_SIZE },
  center: { textAlign: "center" },
  actions: { gap: spacing.sm },
});
