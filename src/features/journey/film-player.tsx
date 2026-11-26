import { Canvas, Group, Picture, Skia, useClock } from "@shopify/react-native-skia";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
import { radius, type } from "@/ui/theme";
import { useReduceMotion } from "@/ui/use-reduce-motion";
import { drawFrame, type Assets } from "./engine/draw";
import type { Scene } from "./engine/model";
import { frameAt } from "./engine/scene";
import { FILM_FRAME } from "./route";

/** What the derived value paints: the first frame, the film running, or the closing title held. */
const IDLE = 0;
const RUNNING = 1;
const HELD = 2;

/** The film in a 9:16 box of `height`. Plays once from the start when `playing`, holds the closing title (before the end card) when it ends, and draws nothing while `paused` (an export is drawing the same scene on another thread). */
export function FilmPlayer({
  scene,
  assets,
  height,
  playing,
  paused,
  onEnd,
}: {
  scene: Scene;
  assets: Assets;
  height: number;
  playing: boolean;
  paused: boolean;
  onEnd?: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const boxWidth = (height * 9) / 16;
  const scale = boxWidth / FILM_FRAME.w;

  // With "Reducir movimiento" the film waits for the button; one press plays it once.
  const [manual, setManual] = useState(false);
  const running = playing && (reduceMotion === false || manual);
  const still = reduceMotion === true && !running;
  useEffect(() => {
    if (!playing) setManual(false);
  }, [playing]);

  const clock = useClock();
  const startAt = useSharedValue(0);
  const mode = useSharedValue(IDLE);
  // Read inside `picture`: while an export draws the same frames, the screen paints nothing.
  const pausedSv = useSharedValue(paused);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    pausedSv.value = paused;
  }, [paused, pausedSv]);

  useEffect(() => {
    if (!running) {
      mode.value = still ? HELD : IDLE;
      return;
    }
    startAt.value = clock.value;
    mode.value = RUNNING;
    const timer = setTimeout(() => {
      mode.value = HELD;
      onEndRef.current?.();
    }, scene.durationMs);
    return () => clearTimeout(timer);
  }, [running, still, scene, clock, startAt, mode]);

  const picture = useDerivedValue(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, FILM_FRAME.w, FILM_FRAME.h));
    if (!pausedSv.value) {
      const m = mode.value;
      const elapsed = clock.value - startAt.value;
      let t = 0;
      if (m === HELD || (m === RUNNING && elapsed >= scene.durationMs)) t = scene.input.timeline.doneAt;
      else if (m === RUNNING) t = elapsed;
      try {
        drawFrame(canvas, scene, frameAt(scene, t), assets);
      } catch {
        // a frame that fails to draw is left empty
      }
    }
    return recorder.finishRecordingAsPicture();
  }, [scene, assets, paused]);

  return (
    <View testID="film-player" style={{ width: boxWidth, height, backgroundColor: "#000", overflow: "hidden" }}>
      <Canvas style={{ width: boxWidth, height }}>
        <Group transform={[{ scale }]}>
          <Picture picture={picture} />
        </Group>
      </Canvas>
      {still ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <View style={styles.center} pointerEvents="box-none">
            <Pressable accessibilityRole="button" accessibilityLabel="Reproducir" onPress={() => setManual(true)} style={styles.pill}>
              <Text style={styles.pillText}>Reproducir</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  pill: { minHeight: 50, borderRadius: radius.full, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, backgroundColor: "rgba(0,0,0,0.55)" },
  pillText: { ...type.headline, color: "#fff" },
});
