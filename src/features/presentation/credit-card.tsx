import { Image } from "expo-image";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { mediaSource } from "@/features/media/revealed";
import { ownedTiming } from "@/ui/motion";
import { spacing, type } from "@/ui/theme";
import { useImageRetry } from "@/ui/use-image-retry";
import { awardNames, type Award } from "./credits";

const ENTER_MS = 400;
const ENTER_RISE = 12;

/** What VoiceOver reads for a credit: "Turno noche: Nico. 03:17, Día 2". */
export function creditLabel(award: Award): string {
  return `${award.title}: ${awardNames(award.names)}. ${award.detail.replace(" · ", ", ")}`;
}

/**
 * One award of the credits: the photo that won it full screen under a dark scrim, with the title, the names and the
 * detail at the bottom. The text rises 12 pt and fades in on mount (opacity only with Reduce Motion); the player
 * remounts it per award, so each one replays it.
 */
export function CreditCard({ award, token }: { award: Award; token: string }) {
  const { photo } = award;
  const retry = useImageRetry(photo.displayPath);
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    // `ownedTiming`: Reduce Motion is handled here (no translate), so Reanimated must not also jump to the end.
    progress.set(withTiming(1, ownedTiming(ENTER_MS)));
    // Mount only: the player remounts the card for every award.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const textStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: reduced ? [] : [{ translateY: (1 - progress.get()) * ENTER_RISE }],
  }));
  return (
    <View style={styles.fill} accessible accessibilityLabel={creditLabel(award)}>
      <Image
        key={retry.retryKey}
        onError={retry.onError}
        onLoad={retry.onLoad}
        style={StyleSheet.absoluteFill}
        source={mediaSource(photo.displayPath, token)}
        placeholder={photo.thumbhash ? { thumbhash: photo.thumbhash } : undefined}
        contentFit="cover"
        transition={200}
        accessible={false}
      />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      <Animated.View pointerEvents="none" style={[styles.text, textStyle]}>
        <Text style={styles.title}>{award.title.toUpperCase()}</Text>
        <Text style={styles.names} numberOfLines={2} adjustsFontSizeToFit>
          {awardNames(award.names)}
        </Text>
        <Text style={styles.detail}>{award.detail}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },
  scrim: { backgroundColor: "rgba(0,0,0,0.55)" },
  text: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingBottom: 72, gap: spacing.xs },
  title: { ...type.footnote, letterSpacing: 1.5, color: "rgba(255,255,255,0.7)" },
  names: { ...type.largeTitle, fontSize: 40, lineHeight: 46, color: "#fff" },
  detail: { ...type.body, color: "rgba(255,255,255,0.7)" },
});
