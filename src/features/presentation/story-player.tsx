import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeartBurst } from "@/features/likes/heart-burst";
import { useDoubleTap } from "@/features/likes/use-double-tap";
import { useToggleLike } from "@/features/likes/use-toggle-like";
import { mediaSource, type RevealedPhoto } from "@/features/media/revealed";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { spacing } from "@/ui/theme";
import { DayCard } from "./day-card";
import { isDownwardDrag, shouldDismiss } from "./dismiss";
import { Outro } from "./outro";
import { initialPlayer, playerReducer } from "./player";
import { ProgressBar } from "./progress-bar";
import { Slide } from "./slide";
import { buildStory, daySegments, stepDuration } from "./story";
import { useScreenReader } from "./use-accessibility";
import { upcomingPhotos } from "./upcoming";

const TAP_BACK_FRACTION = 0.35;
const HOLD_MS = 200;
const MIN_SCALE = 0.9;
const BACKDROP_FADE_DISTANCE = 300;

/**
 * Fullscreen story: days with their photos, outro (the reveal intro is its own screen, `/reveal`). Taps navigate,
 * a double tap on a photo likes it (no counter here), holding pauses, swiping down closes.
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

  // The story changes only if the feed refreshes underneath: start over rather than point at a stale index.
  // Auto-advance: one linear animation per step, resumed from where it was after a pause.
  const progress = useRef(new Animated.Value(0)).current;
  const value = useRef(0);
  const lastIndex = useRef(-1);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else {
      // Starting over also restarts the step's clock (same index 0, but a fresh step).
      lastIndex.current = -1;
      dispatch({ type: "load", steps });
    }
  }, [steps]);
  useEffect(() => {
    const id = progress.addListener(({ value: v }) => {
      value.current = v;
    });
    return () => progress.removeListener(id);
  }, [progress]);
  useEffect(() => {
    if (lastIndex.current !== state.index) {
      lastIndex.current = state.index;
      value.current = 0;
      progress.setValue(0);
    }
    const duration = stepDuration(step);
    if (duration == null || state.paused || screenReader) return;
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: duration * (1 - value.current),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => finished && dispatch({ type: "next" }));
    return () => anim.stop();
  }, [state.index, state.paused, step, progress, screenReader]);

  // Soft haptic on each new day.
  useEffect(() => {
    if (step.kind === "day")
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [step]);

  // Only the next two photos are preloaded; on each day card the memory cache is dropped (what's behind is gone).
  useEffect(() => {
    const urls = upcomingPhotos(
      state.steps,
      state.index,
      state.index === 0 ? 3 : 2,
    ).flatMap((p) => [
      `${mediaSource(p.thumbPath, token).uri}`,
      ...(p.type === "photo" ? [mediaSource(p.originalPath, token).uri] : []),
    ]);
    const headers = { Authorization: `Bearer ${token}` };
    let active = true;
    const run = async () => {
      if (state.steps[state.index]?.kind === "day")
        await Image.clearMemoryCache().catch(() => false);
      if (active && urls.length)
        await Image.prefetch(urls, { headers }).catch(() => false);
    };
    void run();
    return () => {
      active = false;
    };
  }, [state.steps, state.index, token]);

  const held = useRef(false);
  const onPress = useCallback(
    (x: number) =>
      dispatch({ type: x < width * TAP_BACK_FRACTION ? "prev" : "next" }),
    [width],
  );
  const segments = daySegments(state.steps, state.index);

  // On a photo a tap waits out the double-tap window before it moves; a double tap likes it and stays.
  // Day cards, videos and the outro move right away.
  const likes = useToggleLike();
  const stepRef = useRef(step);
  stepRef.current = step;
  const [burst, setBurst] = useState<{ id: string; n: number }>({ id: "", n: 0 });
  const taps = useDoubleTap<number>(onPress, () => {
    const current = stepRef.current;
    if (current.kind !== "photo" || current.photo.type !== "photo") return;
    const { id } = current.photo;
    setBurst((b) => ({ id, n: b.id === id ? b.n + 1 : 1 }));
    // The story's steps keep the photos they were built with: the like state comes from the latest feed.
    const latest = photosRef.current.find((p) => p.id === id) ?? current.photo;
    void likes.like(latest);
  });
  // A tap still waiting out the window belongs to the step it was made on: if the story moves first
  // (auto-advance, a feed reload), drop it, or it would skip the next step unseen.
  useEffect(() => taps.cancel(), [state.index, state.steps, taps]);
  const onSurfacePress = (x: number) => {
    if (step.kind === "photo" && step.photo.type === "photo") taps.tap(x);
    else onPress(x);
  };

  // Swipe down to close, like Instagram stories: the story follows the finger and shrinks while the black fades out.
  const { height } = useWindowDimensions();
  const drag = useRef(new Animated.Value(0)).current;
  const dragging = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const heightRef = useRef(height);
  heightRef.current = height;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) =>
          isDownwardDrag(g.dx, g.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragging.current = true;
          dispatch({ type: "pause" });
        },
        onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (shouldDismiss(g.dy, g.vy)) {
            Animated.timing(drag, {
              toValue: heightRef.current,
              duration: 180,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }).start(() => onCloseRef.current());
          } else {
            dragging.current = false;
            dispatch({ type: "resume" });
            Animated.spring(drag, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          dragging.current = false;
          dispatch({ type: "resume" });
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [drag],
  );
  const scale = drag.interpolate({
    inputRange: [0, height],
    outputRange: [1, MIN_SCALE],
    extrapolate: "clamp",
  });
  const backdrop = drag.interpolate({
    inputRange: [0, BACKDROP_FADE_DISTANCE],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.backdrop,
          { opacity: backdrop },
        ]}
      />
      <Animated.View
        style={[styles.fill, { transform: [{ translateY: drag }, { scale }] }]}
        {...pan.panHandlers}
      >
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
            />
          )}
          {step.kind === "photo" && <HeartBurst key={`heart-${step.photo.id}`} burst={burst.id === step.photo.id ? burst.n : 0} />}
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
    </View>
  );
}

function RoundButton({
  symbol,
  label,
  onPress,
}: {
  symbol: "speaker.slash.fill" | "speaker.wave.2.fill";
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.round, { opacity: pressed ? 0.6 : 1 }]}
    >
      <SymbolView name={symbol} size={16} tintColor="#fff" />
    </Pressable>
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
  round: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
});
