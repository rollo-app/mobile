import { memo, useEffect, useMemo } from "react";
import { StyleSheet, useColorScheme, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { tintHex } from "@/ui/theme";

const PIECES = 40;

type Piece = {
  /** Start, as a fraction of the fall: the pieces don't all leave together. */
  delay: number;
  x: number;
  /** Sideways sway: amplitude (pt), cycles over the fall and phase. */
  drift: number;
  sways: number;
  phase: number;
  /** Spin over the fall, in degrees, and how many times it flips (paper turning over). */
  spin: number;
  flips: number;
  width: number;
  height: number;
  white: boolean;
};

// mulberry32: the same confetti every time (no Math.random in render).
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePieces(width: number): Piece[] {
  const r = random(7);
  return Array.from({ length: PIECES }, (_, i) => ({
    delay: r() * 0.3,
    x: r() * width,
    drift: 12 + r() * 28,
    sways: 0.6 + r() * 1.2,
    phase: r() * Math.PI * 2,
    spin: (r() < 0.5 ? -1 : 1) * (180 + r() * 540),
    flips: 1 + r() * 3,
    width: 6 + r() * 4,
    height: r() < 0.3 ? 6 + r() * 4 : 10 + r() * 6,
    white: i % 2 === 1,
  }));
}

/**
 * A small fall of confetti over the whole screen, in cobalt and white only, played once on mount (`durationMs`).
 * One shared clock on the UI thread drives every piece (transform and opacity only). Not touchable.
 * The caller doesn't mount it under Reduce Motion.
 */
export function Confetti({ durationMs }: { durationMs: number }) {
  const { width, height } = useWindowDimensions();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const pieces = useMemo(() => makePieces(width), [width]);
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.value = withTiming(1, { duration: durationMs, easing: Easing.linear });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View testID="confetti" pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((piece, i) => (
        <ConfettiPiece key={i} piece={piece} clock={clock} fall={height + 60} color={piece.white ? "#FFFFFF" : tintHex[scheme]} />
      ))}
    </View>
  );
}

const ConfettiPiece = memo(function ConfettiPiece({ piece, clock, fall, color }: { piece: Piece; clock: SharedValue<number>; fall: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (clock.value - piece.delay) / (1 - piece.delay)));
    // Falls a bit faster as it goes (gravity, then air), sways, spins and flips over; fades out at the end.
    const y = -30 + fall * (p * (0.55 + 0.45 * p));
    const x = piece.x + Math.sin(piece.phase + p * piece.sways * Math.PI * 2) * piece.drift;
    return {
      opacity: p <= 0 ? 0 : p > 0.85 ? (1 - p) / 0.15 : 1,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${p * piece.spin}deg` },
        { scaleY: Math.cos(p * piece.flips * Math.PI * 2) },
      ],
    };
  });
  return <Animated.View style={[styles.piece, { width: piece.width, height: piece.height, backgroundColor: color }, style]} />;
});

const styles = StyleSheet.create({
  piece: { position: "absolute", left: 0, top: 0, borderRadius: 1.5 },
});
