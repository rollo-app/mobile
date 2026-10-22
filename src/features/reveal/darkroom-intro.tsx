import {
  Blur,
  Canvas,
  Group,
  ImageShader,
  Paint,
  Rect,
  Shader,
  Skia,
  rect,
  useClock,
  type SkImage,
  type SkRuntimeEffect,
  type SkSize,
} from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Presets, usePatternComposer, type Pattern } from "react-native-pulsar";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import type { RevealedPhoto } from "@/features/media/revealed";
import { thumbHashAverageColor } from "@/features/trips/thumbhash-color";
import { spacing, type } from "@/ui/theme";
import { cellFill } from "./cell-fill";
import { DEVELOP_SKSL, GRAIN_SKSL } from "./darkroom-shaders";
import { sampleEvenly } from "./sample-evenly";
import { playShutter, prepareShutter, releaseShutter } from "./shutter-sound";
import { REVEAL_TIMELINE } from "./timeline";
import { useSkiaThumbs } from "./use-skia-thumbs";

const { developAt: DEVELOP_AT, hitAt: HIT_AT, titleAt: TITLE_AT, cellMs: CELL_MS, reduced: REDUCED } = REVEAL_TIMELINE;
const DEVELOP_MS = HIT_AT - DEVELOP_AT;
/** Each cell takes CELL_MS to develop; their starts spread over STAGGER_MS. */
const STAGGER_MS = DEVELOP_MS - CELL_MS;

const COLUMNS = 3;
const MAX_CELLS = 12;
const GAP = 6;
const SIDE = 28;

const DARKROOM = [0x1a / 255, 0, 0] as const;
const SAFELIGHT = "rgb(255, 52, 36)";

/** Rumble during the anticipation, then a ramp that grows with the development (Pulsar, Core Haptics). */
const DEVELOP_HAPTICS: Pattern = {
  discretePattern: Array.from({ length: 9 }, (_, i) => ({
    time: DEVELOP_AT + 400 + i * 400,
    amplitude: 0.2 + (i / 8) * 0.5,
    frequency: 0.35,
  })),
  continuousPattern: {
    amplitude: [
      { time: 0, value: 0.18 },
      { time: DEVELOP_AT, value: 0.25 },
      { time: HIT_AT - 50, value: 0.85 },
      { time: HIT_AT, value: 0 },
    ],
    frequency: [
      { time: 0, value: 0.08 },
      { time: DEVELOP_AT, value: 0.15 },
      { time: HIT_AT - 50, value: 0.6 },
      { time: HIT_AT, value: 0.6 },
    ],
  },
};

/**
 * The reveal: a darkroom. Red safelight and grain ("Revelando {rollo}"), the roll's photos develop
 * on one Skia canvas (noise threshold from the edges, sepia → color, blur 20 → 0) while the haptics
 * grow, a hit (heavy + success, shutter sound) washes the red to white, and the title shows. Timed
 * by `REVEAL_TIMELINE`; `RevealScreen` moves on after `totalMs`.
 */
export function DarkroomIntro({
  photos,
  token,
  title,
  date,
  reduceMotion,
}: {
  photos: RevealedPhoto[];
  token: string;
  title: string;
  date: string;
  reduceMotion: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const cells = useMemo(() => sampleEvenly(photos, MAX_CELLS), [photos]);
  const images = useSkiaThumbs(cells, token);
  const effects = useMemo(
    () => ({ grain: Skia.RuntimeEffect.Make(GRAIN_SKSL), develop: Skia.RuntimeEffect.Make(DEVELOP_SKSL) }),
    [],
  );

  const rows = Math.max(1, Math.ceil(cells.length / COLUMNS));
  const size = Math.min((width - SIDE * 2 - GAP * (COLUMNS - 1)) / COLUMNS, (height * 0.62 - GAP * (rows - 1)) / rows);
  const gridWidth = size * COLUMNS + GAP * (COLUMNS - 1);
  const gridLeft = (width - gridWidth) / 2;
  const gridTop = (height - (size * rows + GAP * (rows - 1))) / 2;

  const clock = useClock();
  const develop = useSharedValue(reduceMotion ? 1 : 0);
  const safelight = useSharedValue(reduceMotion ? 0 : 0.8);
  const darken = useSharedValue(reduceMotion ? 1 : 0);
  const flash = useSharedValue(0);
  const gridOpacity = useSharedValue(reduceMotion ? 0 : 1);
  const kicker = useSharedValue(0);
  const titleOpacity = useSharedValue(0);

  const haptics = usePatternComposer(DEVELOP_HAPTICS);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    if (reduceMotion) {
      // Plain fades, but they must still play: Reanimated's default (ReduceMotion.System) would skip
      // the delays and jump to the end, showing the title at frame 0.
      const never = { reduceMotion: ReduceMotion.Never };
      const { fadeInMs, hapticAt, dimAt, dimMs, dimOpacity } = REDUCED;
      gridOpacity.value = withSequence(
        ReduceMotion.Never,
        withTiming(1, { duration: fadeInMs, ...never }),
        withDelay(dimAt - fadeInMs, withTiming(dimOpacity, { duration: dimMs, ...never }), ReduceMotion.Never),
      );
      at(hapticAt, () => Presets.System.notificationSuccess());
      titleOpacity.value = withDelay(dimAt, withTiming(1, { duration: dimMs, ...never }), ReduceMotion.Never);
      return () => timers.forEach(clearTimeout);
    }

    void prepareShutter();
    haptics.play();
    kicker.value = withSequence(withTiming(1, { duration: 500 }), withDelay(1000, withTiming(0, { duration: 600 })));
    develop.value = withDelay(DEVELOP_AT, withTiming(1, { duration: DEVELOP_MS, easing: Easing.linear }));
    at(HIT_AT, () => {
      Presets.System.impactHeavy();
      playShutter();
      setTimeout(() => Presets.System.notificationSuccess(), 120);
    });
    flash.value = withDelay(HIT_AT, withSequence(withTiming(0.9, { duration: 60 }), withTiming(0, { duration: 400 })));
    safelight.value = withDelay(HIT_AT, withTiming(0, { duration: 400 }));
    darken.value = withDelay(HIT_AT, withTiming(1, { duration: 400 }));
    gridOpacity.value = withDelay(TITLE_AT, withTiming(0.25, { duration: 700 }));
    titleOpacity.value = withDelay(TITLE_AT, withTiming(1, { duration: 700 }));

    return () => {
      timers.forEach(clearTimeout);
      haptics.stop();
      releaseShutter();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const grainUniforms = useDerivedValue(() => ({
    time: clock.value / 1000,
    strength: 1 - darken.value,
    base: [...DARKROOM],
  }));

  const kickerStyle = useAnimatedStyle(() => ({ opacity: kicker.value }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }));
  const screen = rect(0, 0, width, height);

  return (
    <View style={styles.fill} accessible accessibilityLabel={`${title}. Se reveló el ${date}.`}>
      <Canvas style={StyleSheet.absoluteFill}>
        {effects.grain && !reduceMotion ? (
          <Rect rect={screen}>
            <Shader source={effects.grain} uniforms={grainUniforms} />
          </Rect>
        ) : null}
        <Rect rect={screen} color="black" opacity={darken} />
        <Group opacity={gridOpacity}>
          {cells.map((photo, i) => (
            <DevelopingCell
              key={photo.id}
              effect={effects.develop}
              image={images[photo.id] ?? null}
              thumbhash={photo.thumbhash}
              x={gridLeft + (i % COLUMNS) * (size + GAP)}
              y={gridTop + Math.floor(i / COLUMNS) * (size + GAP)}
              size={size}
              delay={(((i * 7) % cells.length) / cells.length) * STAGGER_MS}
              develop={develop}
              clock={clock}
            />
          ))}
        </Group>
        <Rect rect={screen} color={SAFELIGHT} blendMode="multiply" opacity={safelight} />
        <Rect rect={screen} color="white" opacity={flash} />
      </Canvas>

      <Animated.View pointerEvents="none" style={[styles.center, kickerStyle]}>
        <Text style={styles.developing}>Revelando {title}</Text>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.center, styles.titleBox, titleStyle]}>
        <Text style={styles.kicker}>Se reveló</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.date}>{date}</Text>
      </Animated.View>
    </View>
  );
}

function DevelopingCell({
  effect,
  image,
  thumbhash,
  x,
  y,
  size,
  delay,
  develop,
  clock,
}: {
  effect: SkRuntimeEffect | null;
  image: SkImage | null;
  thumbhash: string | null;
  x: number;
  y: number;
  size: number;
  delay: number;
  develop: SharedValue<number>;
  clock: SharedValue<number>;
}) {
  const avg = thumbhash ? thumbHashAverageColor(thumbhash) : null;
  const base = avg ? [avg.r / 255, avg.g / 255, avg.b / 255] : [0.25, 0.22, 0.2];
  const cellSize: SkSize = { width: size, height: size };

  const progress = useDerivedValue(() => {
    const p = Math.min(1, Math.max(0, (develop.value * DEVELOP_MS - delay) / CELL_MS));
    return p * p * (3 - 2 * p);
  });
  const uniforms = useDerivedValue(() => ({
    size: [cellSize.width, cellSize.height],
    progress: progress.value,
    time: clock.value / 1000,
    base,
  }));
  const blur = useDerivedValue(() => 20 * (1 - progress.value));
  const bounds = rect(0, 0, size, size);
  const fill = cellFill(!!effect, !!image);

  return (
    <Group
      transform={[{ translateX: x }, { translateY: y }]}
      clip={bounds}
      layer={
        <Paint>
          <Blur blur={blur} mode="clamp" />
        </Paint>
      }
    >
      {fill === "develop" && image && effect ? (
        <Rect rect={bounds}>
          <Shader source={effect} uniforms={uniforms}>
            <ImageShader image={image} fit="cover" rect={bounds} />
          </Shader>
        </Rect>
      ) : fill === "image" && image ? (
        <Rect rect={bounds}>
          <ImageShader image={image} fit="cover" rect={bounds} />
        </Rect>
      ) : (
        <Rect rect={bounds} color={Skia.Color(`rgb(${base.map((c) => Math.round(c * 255)).join(",")})`)} />
      )}
    </Group>
  );
}

const SERIF = type.quote.fontFamily;

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#1a0000" },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  titleBox: { gap: spacing.sm },
  developing: { fontFamily: SERIF, fontSize: 24, color: "rgba(255, 196, 186, 0.9)", textAlign: "center" },
  kicker: { ...type.subhead, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: 1.5 },
  title: { fontFamily: SERIF, fontSize: 34, lineHeight: 40, color: "#fff", textAlign: "center" },
  date: { ...type.body, color: "rgba(255,255,255,0.75)" },
});
