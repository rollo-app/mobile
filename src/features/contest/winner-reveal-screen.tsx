import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { usePatternComposer, type Pattern } from "react-native-pulsar";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMe } from "@/features/auth/use-me";
import { DevelopImage } from "@/features/darkroom/develop-image";
import { playShutter, prepareShutter, releaseShutter } from "@/features/darkroom/shutter-sound";
import { useThumbBytes, type ThumbRef } from "@/features/darkroom/use-thumb-bytes";
import { mediaSource, useMediaToken } from "@/features/media/revealed";
import { Avatar } from "@/features/profile/avatar";
import { Button } from "@/ui/components";
import { easeOut } from "@/ui/motion";
import { screenBackgrounds, spacing, type } from "@/ui/theme";
import { useReduceMotion } from "@/ui/use-reduce-motion";
import { Confetti } from "./confetti";
import { authorHandle, votesLabel, winnerLine } from "./contest-state";
import { useContest } from "./use-contest";
import { WINNER_TIMELINE } from "./winner-timeline";

const { developMs: DEVELOP_MS, flashMs: FLASH_MS, textDelayMs: TEXT_AT, confettiDelayMs: CONFETTI_AT, confettiMs: CONFETTI_MS } = WINNER_TIMELINE;

const SAFELIGHT = "rgb(255, 52, 36)";
const SIDE = 28;
const NO_THUMBS: ThumbRef[] = [];

/** A rumble that grows with the development and stops at the flash (Pulsar, Core Haptics); ticks come closer and harder. */
const DEVELOP_HAPTICS: Pattern = {
  discretePattern: Array.from({ length: 8 }, (_, i) => ({
    time: Math.round(250 + (DEVELOP_MS - 350) * Math.sqrt(i / 7)),
    amplitude: 0.2 + (i / 7) * 0.55,
    frequency: 0.4,
  })),
  continuousPattern: {
    amplitude: [
      { time: 0, value: 0.15 },
      { time: DEVELOP_MS - 50, value: 0.85 },
      { time: DEVELOP_MS, value: 0 },
    ],
    frequency: [
      { time: 0, value: 0.1 },
      { time: DEVELOP_MS - 50, value: 0.6 },
      { time: DEVELOP_MS, value: 0.6 },
    ],
  },
};

/**
 * The photo contest's winner, revealed once (`useWinnerReveal` opens it): a darkroom where the winning photo develops
 * from its ThumbHash (sepia, blurry → sharp) while the haptic grows, a white flash (success haptic + shutter), then
 * "Ganó la foto de @…" with the author's avatar and the votes, a little cobalt-and-white confetti and "Ver resultados".
 * A tap anywhere skips to the end. Reduce Motion: no shader and no confetti, a 300 ms fade and one success haptic.
 * A winner hidden from this viewer (`imageAvailable: false`) shows no photo, only the line.
 */
export function WinnerRevealScreen({ tripId }: { tripId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { contest, error } = useContest(tripId);
  const { me } = useMe();
  const token = useMediaToken(tripId);
  const reduceMotion = useReduceMotion();

  // Back to the contest if it's under this screen, or in its place (opened over the gallery); only once.
  const done = useRef(false);
  const toResults = useCallback(() => {
    if (done.current) return;
    done.current = true;
    router.dismissTo(`/contest?trip=${tripId}`);
  }, [router, tripId]);

  const winner = contest?.status === "closed" ? contest.winner : null;
  const finalist = winner ? contest?.finalists.find((f) => f.mediaId === winner.mediaId) : undefined;
  const showPhoto = !!winner?.imageAvailable && !!finalist;
  const develop = showPhoto && reduceMotion === false;

  // The thumb is downloaded before anything mounts, so the photo never shows sharp before it develops.
  const thumbRefs = useMemo<ThumbRef[]>(() => (finalist ? [{ id: finalist.mediaId, thumbPath: finalist.thumbPath }] : NO_THUMBS), [finalist]);
  const thumbs = useThumbBytes(thumbRefs, token ?? "", develop && !!token, WINNER_TIMELINE.thumbsCapMs);

  const nothing = !!contest && !winner;
  const ready = !!winner && !!token && reduceMotion !== null && (!develop || thumbs.settled);

  useEffect(() => {
    if (nothing || (error && !contest)) toResults();
  }, [nothing, error, contest, toResults]);

  // A safety net while it loads: with weak signal a request can hang, and the results have their own states.
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(toResults, WINNER_TIMELINE.loadingTimeoutMs);
    return () => clearTimeout(timer);
  }, [ready, toResults]);

  if (!ready || !winner) {
    return (
      <Pressable
        testID="winner-loading"
        style={[styles.root, styles.loading]}
        accessibilityLabel="Cargando la ganadora"
        accessibilityHint="Tocá para ver los resultados"
        onPress={toResults}
      >
        <StatusBar style="light" />
        <ActivityIndicator color="#fff" />
      </Pressable>
    );
  }

  const aspect = finalist?.width && finalist.height ? finalist.width / finalist.height : 3 / 4;
  const photoWidth = Math.min(window.width - SIDE * 2, window.height * 0.5 * aspect);
  const photoSize = { width: photoWidth, height: photoWidth / aspect };
  const display = finalist ? mediaSource(finalist.displayPath, token!) : null;

  return (
    <WinnerReveal
      line={winnerLine(winner.author, me?.id)}
      mine={winner.author.userId === me?.id}
      votes={finalist && finalist.votes !== null ? votesLabel(finalist.votes) : null}
      author={winner.author}
      photo={showPhoto && display ? { ...display, size: photoSize, thumbBytes: thumbs.bytes[finalist!.mediaId] ?? null, thumbhash: finalist!.thumbHash } : null}
      reduceMotion={reduceMotion === true}
      bottomInset={insets.bottom}
      onDone={toResults}
    />
  );
}

type RevealPhoto = { uri: string; headers: Record<string, string>; size: { width: number; height: number }; thumbBytes: ArrayBuffer | null; thumbhash: string | null };

/** The sequence itself, mounted once everything it needs is in (it reads Reduce Motion once). */
function WinnerReveal({
  line,
  mine,
  votes,
  author,
  photo,
  reduceMotion,
  bottomInset,
  onDone,
}: {
  line: string;
  /** The viewer took the winning photo: "¡Ganó tu foto!" with the avatar, no "Ganó la foto de". */
  mine: boolean;
  votes: string | null;
  author: { userId: string; name: string; username: string | null; avatarUrl: string | null };
  photo: RevealPhoto | null;
  reduceMotion: boolean;
  bottomInset: number;
  onDone: () => void;
}) {
  // Develops with the shader only when the thumb came in; otherwise the photo just fades in at the flash.
  const developing = !reduceMotion && !!photo?.thumbBytes;
  // No photo to develop (hidden from this viewer) or Reduce Motion: the quiet path, plain fades and one success haptic.
  const quick = reduceMotion || !photo;
  const [finished, setFinished] = useState(quick);
  const [confetti, setConfetti] = useState(false);

  const progress = useSharedValue(quick ? 1 : 0);
  const room = useSharedValue(quick ? 0 : 1);
  const safelight = useSharedValue(quick ? 0 : 0.8);
  const flash = useSharedValue(0);
  const sharp = useSharedValue(0);
  const text = useSharedValue(0);
  const button = useSharedValue(quick ? 0 : 1);

  const haptics = usePatternComposer(DEVELOP_HAPTICS);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hit = useRef(false);

  const success = useCallback(() => {
    if (hit.current) return;
    hit.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  useEffect(() => {
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    const enter = easeOut();

    if (quick) {
      // Plain fades that must still play: Reanimated's default (ReduceMotion.System) would jump them to the end.
      const fade = { duration: WINNER_TIMELINE.reducedFadeMs, easing: enter, reduceMotion: ReduceMotion.Never };
      sharp.value = withTiming(1, fade);
      text.value = withTiming(1, fade);
      button.value = withTiming(1, fade);
      success();
      // Confetti still plays when motion isn't reduced (a hidden winner), once the text is in.
      if (!reduceMotion) at(WINNER_TIMELINE.reducedFadeMs, () => setConfetti(true));
      return () => timers.current.forEach(clearTimeout);
    }

    void prepareShutter();
    haptics.play();
    // Slow to start, sharpening toward the flash, in step with the haptic crescendo.
    progress.value = withTiming(1, { duration: DEVELOP_MS, easing: Easing.bezier(0.4, 0, 0.6, 1) });
    at(DEVELOP_MS, () => {
      success();
      playShutter();
    });
    flash.value = withDelay(DEVELOP_MS, withSequence(withTiming(0.9, { duration: 60 }), withTiming(0, { duration: FLASH_MS - 60, easing: enter })));
    safelight.value = withDelay(DEVELOP_MS, withTiming(0, { duration: FLASH_MS }));
    room.value = withDelay(DEVELOP_MS, withTiming(0, { duration: FLASH_MS }));
    // The full-size photo takes over from the developed thumb under the flash.
    sharp.value = withDelay(DEVELOP_MS, withTiming(1, { duration: 200 }));
    text.value = withDelay(TEXT_AT, withTiming(1, { duration: 500, easing: enter }));
    at(CONFETTI_AT, () => setConfetti(true));
    at(TEXT_AT + WINNER_TIMELINE.buttonDelayMs, () => setFinished(true));

    return () => {
      timers.current.forEach(clearTimeout);
      haptics.stop();
      releaseShutter();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const skip = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    haptics.stop();
    success();
    progress.value = 1;
    room.value = 0;
    safelight.value = 0;
    flash.value = 0;
    sharp.value = 1;
    text.value = 1;
    setConfetti(true);
    setFinished(true);
  }, [haptics, success]); // eslint-disable-line react-hooks/exhaustive-deps

  const roomStyle = useAnimatedStyle(() => ({ opacity: room.value }));
  const safelightStyle = useAnimatedStyle(() => ({ opacity: safelight.value }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const sharpStyle = useAnimatedStyle(() => ({ opacity: sharp.value }));
  const textStyle = useAnimatedStyle(() => ({ opacity: text.value, transform: [{ translateY: (1 - text.value) * 8 }] }));
  const buttonStyle = useAnimatedStyle(() => ({ opacity: button.value }));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.room, roomStyle]} />

      {/* Hidden from VoiceOver while it plays: the "Saltar el revelado" surface covers it. */}
      <View style={styles.center} accessibilityElementsHidden={!finished} importantForAccessibility={finished ? "auto" : "no-hide-descendants"}>
        {!!photo && (
          <View style={[styles.photo, photo.size]}>
            {developing && <DevelopImage thumbBytes={photo.thumbBytes} uri={photo.uri} headers={photo.headers} progress={progress} size={photo.size} thumbhash={photo.thumbhash} />}
            <Animated.View style={[StyleSheet.absoluteFill, sharpStyle]}>
              <Image
                testID="winner-photo"
                source={{ uri: photo.uri, headers: photo.headers }}
                contentFit="cover"
                style={StyleSheet.absoluteFill}
                accessibilityLabel="La foto ganadora"
              />
            </Animated.View>
            {!reduceMotion && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.safelight, safelightStyle]} />}
          </View>
        )}
        <Animated.View style={[styles.text, textStyle]}>
          {/* The avatar goes right next to the @: "Ganó la foto de" on top, then the photo and the handle. Read as one line. */}
          <View style={styles.headline} accessible accessibilityLabel={line}>
            {!mine && <Text style={styles.line}>Ganó la foto de</Text>}
            <View style={styles.byline}>
              <Avatar id={author.userId} name={author.name} avatarUrl={author.avatarUrl} size={28} />
              <Text style={styles.line} numberOfLines={2}>
                {mine ? line : authorHandle(author)}
              </Text>
            </View>
          </View>
          {!!votes && <Text style={styles.votes}>{votes}</Text>}
        </Animated.View>
      </View>

      {finished && (
        <Animated.View style={[styles.footer, { paddingBottom: bottomInset + spacing.md }, buttonStyle]}>
          <Button label="Ver resultados" onPress={onDone} />
        </Animated.View>
      )}

      {confetti && !reduceMotion && <Confetti durationMs={CONFETTI_MS} />}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />

      {!finished && (
        <Pressable
          testID="winner-skip"
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Saltar el revelado"
          accessibilityHint="Tocá para ver la ganadora"
          onPress={skip}
        />
      )}
    </View>
  );
}

const SERIF = type.quote.fontFamily;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  loading: { alignItems: "center", justifyContent: "center", backgroundColor: screenBackgrounds.reveal },
  room: { backgroundColor: screenBackgrounds.reveal },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, paddingHorizontal: SIDE },
  photo: { borderRadius: 6, borderCurve: "continuous", overflow: "hidden", backgroundColor: "rgba(255,255,255,0.06)" },
  safelight: { backgroundColor: SAFELIGHT, mixBlendMode: "multiply" },
  flash: { backgroundColor: "#fff" },
  text: { alignItems: "center", gap: spacing.xs },
  headline: { alignItems: "center", gap: spacing.xs },
  byline: { flexDirection: "row", alignItems: "center", gap: spacing.sm, maxWidth: "100%" },
  line: { fontFamily: SERIF, fontSize: 24, lineHeight: 30, color: "#fff", flexShrink: 1 },
  votes: { ...type.body, color: "rgba(255,255,255,0.75)", fontVariant: ["tabular-nums"] },
  footer: { paddingHorizontal: SIDE },
});
