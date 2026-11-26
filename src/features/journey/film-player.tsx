import { Canvas, Group, Picture, Skia, useClock } from "@shopify/react-native-skia";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
import { radius, type } from "@/ui/theme";
import { useReduceMotion } from "@/ui/use-reduce-motion";
import { drawAnyFilm, type AnyFilm } from "./any-film";
import { FILM_FRAME } from "./route";

/** What the derived value paints: the first frame, the film running, or the closing title held. */
const IDLE = 0;
const RUNNING = 1;
const HELD = 2;

/**
 * The film in a 9:16 box of `height`. Plays once from the start when `playing`, holds the closing title (before the end card) when it ends, and draws nothing while `paused` (an export is drawing the same film on another thread).
 * A new `film` while playing restarts from 0, and `onEnd` fires again at its end.
 */
export function FilmPlayer({
  film,
  height,
  playing,
  paused,
  onEnd,
}: {
  film: AnyFilm;
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
    }, film.durationMs);
    return () => clearTimeout(timer);
  }, [running, still, film, clock, startAt, mode]);

  const picture = useDerivedValue(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, FILM_FRAME.w, FILM_FRAME.h));
    // The prop itself is read too: the first run after it changes must already be empty, before the effect writes the shared value.
    if (!paused && !pausedSv.value) {
      const m = mode.value;
      const elapsed = clock.value - startAt.value;
      let t = 0;
      if (m === HELD || (m === RUNNING && elapsed >= film.durationMs)) t = film.restAt;
      else if (m === RUNNING) t = elapsed;
      try {
        drawAnyFilm(canvas, film, t);
      } catch {
        // a frame that fails to draw is left empty
      }
    }
    return recorder.finishRecordingAsPicture();
  }, [film, paused]);

  return (
    <View testID="film-player" style={{ width: boxWidth, height, backgroundColor: "#000", overflow: "hidden" }}>
      <Canvas style={{ width: boxWidth, height }}>
        <Group transform={[{ scale }]}>
          <Picture picture={picture} />
        </Group>
      </Canvas>
      {still && playing ? (
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
