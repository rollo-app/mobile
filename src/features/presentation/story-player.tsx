import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { useToggleLike } from "@/features/likes/use-toggle-like";
import type { RevealedPhoto } from "@/features/media/revealed";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { easeOut } from "@/ui/motion";
import { spacing } from "@/ui/theme";
import { DayCard } from "./day-card";
import { isDownwardDrag, shouldDismiss } from "./dismiss";
import { Outro } from "./outro";
import { initialPlayer, playerReducer } from "./player";
import { ProgressBar } from "./progress-bar";
import { RoundButton } from "./round-button";
import { Slide } from "./slide";
import { buildStory, daySegments } from "./story";
import { useScreenReader } from "./use-accessibility";
import { useStoryClock } from "./use-story-clock";
import { useStoryPrefetch } from "./use-story-prefetch";

const TAP_BACK_FRACTION = 0.35;
const HOLD_MS = 200;
const MIN_SCALE = 0.9;
const CLOSE_MS = 180;
const SNAP_BACK = { stiffness: 158, damping: 20, mass: 1 } as const;
const BACKDROP_FADE_DISTANCE = 300;

/**
 * Fullscreen story: days with their photos, outro (the reveal intro is its own screen, `/reveal`). Taps navigate,
 * a double tap on a photo likes it and its heart toggles it (no counter here), holding pauses, swiping down closes.
 */
export function StoryPlayer({
  photos,
  token,
  timeZone,
  onClose,
}: {
  photos: RevealedPhoto[];
  token: string;
  timeZone: string;
  onClose: () => void;
}) {
  // A refetch hands over a new array with the same photos: rebuild the story only when the photos really change,
  // otherwise the story would start over under the viewer.
  const photoKey = photos.map((p) => p.id).join(",");
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const steps = useMemo(
    () => buildStory(photosRef.current, timeZone),
    [photoKey, timeZone], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [state, dispatch] = useReducer(playerReducer, steps, initialPlayer);
  const step = state.steps[state.index]!;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const screenReader = useScreenReader();
  const [muted, setMuted] = useState(true);
  const openProfile = useOpenProfile();

  const progress = useStoryClock({
    steps,
    index: state.index,
    step,
    paused: state.paused,
    screenReader,
    dispatch,
  });

  // Soft haptic on each new day.
  useEffect(() => {
    if (step.kind === "day")
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [step]);

  useStoryPrefetch(state.steps, state.index, token);

  const held = useRef(false);
  const onPress = useCallback(
    (x: number) =>
      dispatch({ type: x < width * TAP_BACK_FRACTION ? "prev" : "next" }),
    [width],
  );
  const segments = daySegments(state.steps, state.index);

  // Taps always move right away (a quick double tap skips two): in stories the like is only the heart.
  const likes = useToggleLike();
  // The story's steps keep the photos they were built with: the like state comes from the latest feed.
  const latestOf = (photo: RevealedPhoto) => photosRef.current.find((p) => p.id === photo.id) ?? photo;
  const onSurfacePress = onPress;

  // Swipe down to close, like Instagram stories: the story follows the finger and shrinks while the black fades out.
  // The drag runs on the UI thread (Gesture Handler + shared values); it only crosses to JS to pause, resume and close.
  const { height } = useWindowDimensions();
  const drag = useSharedValue(0);
  const origin = useSharedValue({ x: 0, y: 0 });
  const dragging = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const startDrag = useCallback(() => {
    dragging.current = true;
    dispatch({ type: "pause" });
  }, []);
  const endDrag = useCallback(() => {
    dragging.current = false;
    dispatch({ type: "resume" });
  }, []);
  const closeStory = useCallback(() => onCloseRef.current(), []);
  const pan = useMemo(() => {
    const closeEasing = easeOut();
    return (
      Gesture.Pan()
        .withTestId("story-pan")
        // Manual activation keeps the exact rule of `isDownwardDrag` (clearly vertical and downward): until then taps
        // and holds go to the surface, and a double tap or the heart never lose to the drag.
        .manualActivation(true)
        .onTouchesDown((e) => {
          if (e.numberOfTouches === 1) {
            const t = e.allTouches[0]!;
            origin.value = { x: t.absoluteX, y: t.absoluteY };
          }
        })
        .onTouchesMove((e, manager) => {
          if (e.numberOfTouches !== 1) return;
          const t = e.allTouches[0]!;
          if (
            isDownwardDrag(
              t.absoluteX - origin.value.x,
              t.absoluteY - origin.value.y,
            )
          )
            manager.activate();
        })
        .onStart(() => {
          scheduleOnRN(startDrag);
        })
        .onUpdate((e) => {
          drag.value = Math.max(0, e.translationY);
        })
        .onEnd((e, success) => {
          // `velocityY` is pt/s, `shouldDismiss` takes pt/ms.
          if (success && shouldDismiss(e.translationY, e.velocityY / 1000)) {
            drag.value = withTiming(
              height,
              { duration: CLOSE_MS, easing: closeEasing },
              () => {
                scheduleOnRN(closeStory);
              },
            );
          } else {
            drag.value = withSpring(0, SNAP_BACK);
            scheduleOnRN(endDrag);
          }
        })
    );
  }, [drag, origin, height, startDrag, endDrag, closeStory]);
  const storyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: drag.value },
      {
        scale: interpolate(
          drag.value,
          [0, height],
          [1, MIN_SCALE],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      drag.value,
      [0, BACKDROP_FADE_DISTANCE],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
      />
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.fill, storyStyle]}>
          <Pressable
            testID="story-surface"
            style={styles.fill}
            delayLongPress={HOLD_MS}
            onPress={(e) => onSurfacePress(e.nativeEvent.locationX)}
            onLongPress={() => {
              held.current = true;
              dispatch({ type: "pause" });
            }}
            onPressOut={() => {
              if (held.current) {
                held.current = false;
                if (!dragging.current) dispatch({ type: "resume" });
              }
            }}
            accessibilityActions={[
              { name: "increment", label: "Siguiente" },
              { name: "decrement", label: "Anterior" },
              { name: "escape", label: "Cerrar presentación" },
            ]}
            onAccessibilityAction={(e) => {
              const name = e.nativeEvent.actionName;
              if (name === "escape") onClose();
              else dispatch({ type: name === "increment" ? "next" : "prev" });
            }}
          >
            {step.kind === "day" && <DayCard step={step} />}
            {step.kind === "photo" && (
              <Slide
                key={step.photo.id}
                photo={step.photo}
                token={token}
                timeZone={timeZone}
                paused={state.paused}
                muted={muted}
                // Leaves the presentation (a modal) and opens the author's profile over the tabs.
                onAuthor={() => {
                  dispatch({ type: "pause" });
                  openProfile(step.photo.authorUserId, { leave: true });
                }}
                liked={latestOf(step.photo).likedByMe}
                onToggleLike={() => void likes.toggle(latestOf(step.photo))}
              />
            )}
            {step.kind === "outro" && (
              <Outro
                stats={step.stats}
                onGallery={onClose}
                onReplay={() => dispatch({ type: "restart" })}
              />
            )}
          </Pressable>

          <View
            style={[styles.top, { paddingTop: insets.top + spacing.sm }]}
            pointerEvents="box-none"
          >
            {segments && (
              <ProgressBar
                count={segments.count}
                current={segments.current}
                progress={progress}
              />
            )}
            <View style={styles.buttons} pointerEvents="box-none">
              {step.kind === "photo" && step.photo.type === "video" ? (
                <RoundButton
                  symbol={muted ? "speaker.slash.fill" : "speaker.wave.2.fill"}
                  label={muted ? "Activar el sonido" : "Silenciar"}
                  onPress={() => setMuted((m) => !m)}
                />
              ) : (
                <View />
              )}
              <View />
            </View>
          </View>
          {/* Invisible, for VoiceOver users who can't swipe the story away. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar presentación"
            onPress={onClose}
            style={styles.hiddenClose}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: "#000" },
  fill: { flex: 1, backgroundColor: "#000" },
  hiddenClose: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
  top: { position: "absolute", top: 0, left: 0, right: 0, gap: spacing.sm },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
  },
});
