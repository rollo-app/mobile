import { Image } from "expo-image";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { colors, radius, type } from "@/ui/theme";
import { useReduceMotion } from "@/ui/use-reduce-motion";
import { buildContactSheet, newestEntered } from "./contact-sheet";

const COLUMNS = 6;
const GAP = 3;

/**
 * The contact sheet: one frame per photo in the roll, not yet developed. Each shows
 * the blurry colors (ThumbHash) of its photo, newest to oldest; without a thumbhash
 * it's gray, and the filler frames in the last row are dimmer. When a photo is added
 * while this is on screen, only its frame enters (scale + fade); the rest just reflows.
 */
export function ContactSheet({
  total,
  feed,
  pending,
}: {
  total: number;
  feed: { id?: string; takenAt: number; thumbhash: string | null }[];
  pending: { id?: string; takenAt: number; thumbhash: string | null }[];
}) {
  const { frames, keys, rest } = buildContactSheet({ feed, pending, total });
  const shown = frames.length;
  const cells = Math.max(Math.ceil(shown / COLUMNS), 1) * COLUMNS;

  const previous = useRef<{ keys: string[]; total: number } | null>(null);
  const entering = newestEntered(previous.current, { keys, total });
  const keysSignature = keys.join("|");
  useEffect(() => {
    previous.current = { keys, total };
    // `keys` is fully described by its signature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysSignature, total]);

  return (
    <View accessible accessibilityLabel={`${total} en el rollo`} style={styles.sheet}>
      <View style={styles.grid}>
        {Array.from({ length: cells }, (_, i) => {
          const thumbhash = frames[i];
          return (
            <View key={i < shown ? keys[i] : `filler-${i}`} style={styles.cell}>
              <EnteringFrame enter={i < shown && keys[i] === entering}>
                <View style={[styles.frame, { backgroundColor: i < shown ? colors.latent : colors.fill }]}>
                  {thumbhash && <Image testID={`thumbhash-${thumbhash}`} placeholder={{ thumbhash }} style={StyleSheet.absoluteFill} />}
                  {rest > 0 && i === shown - 1 && (
                    <>
                      {thumbhash && <View style={styles.dim} />}
                      <Text style={[type.footnote, styles.more, thumbhash ? styles.moreOnPhoto : null]}>+{rest + 1}</Text>
                    </>
                  )}
                </View>
              </EnteringFrame>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Plays the entrance once, on mount, only if `enter` is true then; later changes of `enter` do nothing. */
function EnteringFrame({ enter, children }: { enter: boolean; children: React.ReactNode }) {
  const reduceMotion = useReduceMotion();
  const reduced = reduceMotion !== false;
  const progress = useSharedValue(enter ? 0 : 1);
  useEffect(() => {
    if (!enter) return;
    progress.set(
      withTiming(1, { duration: reduced ? 200 : 300, easing: Easing.bezier(0.23, 1, 0.32, 1) }),
    );
    // Mount only: this frame enters once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: reduced ? [] : [{ scale: 0.9 + 0.1 * progress.get() }],
  }));
  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  sheet: {
    borderRadius: radius.md,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  // Half a gap of padding per cell, cancelled by the negative margin and clipped by `sheet`: a flat
  // wrapping grid (so frames keep their identity when they move to another row) with the same look.
  grid: { flexDirection: "row", flexWrap: "wrap", margin: -GAP / 2 },
  cell: { width: `${100 / COLUMNS}%`, aspectRatio: 1, padding: GAP / 2 },
  fill: { flex: 1 },
  frame: { flex: 1, alignItems: "center", justifyContent: "center" },
  more: { color: colors.secondaryLabel, fontWeight: "600" },
  moreOnPhoto: { color: "#FFFFFF" },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.35)" },
});
