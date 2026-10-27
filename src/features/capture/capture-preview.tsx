import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Alert, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SymbolView } from "expo-symbols";
import Animated, {
  cubicBezier,
  ReduceMotion,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type CSSTransitionProperties,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CapturedPhoto } from "@/features/camera/captured-photo";
import { ErrorText } from "@/ui/components";
import { insetFrame } from "@/ui/inset-frame";
import { EASE_OUT_BEZIER, easeOut } from "@/ui/motion";
import { useReduceMotion } from "@/ui/use-reduce-motion";
import { colors, radius, spacing, type } from "@/ui/theme";
import { bottomPadding } from "./bottom-padding";
import { sendExit } from "./send-exit";

export type Shot = { photo: CapturedPhoto; takenAt: number };

// Strong enough that the photo can't be recognized: the shot is the shot, you only get to caption it.
const BLUR_RADIUS = 100;
// Outside StyleSheet.create: its types don't know Reanimated's CSS transition keys. On native the curve must be
// `cubicBezier()` (a "cubic-bezier(...)" string only works on web and throws on iOS), built lazily so importing this
// file never touches Reanimated.
let pressTransition: CSSTransitionProperties | undefined;
const getPressTransition = () =>
  (pressTransition ??= {
    transitionProperty: ["transform", "opacity"],
    transitionDuration: 120,
    transitionTimingFunction: cubicBezier(...EASE_OUT_BEZIER),
  });

/**
 * The shot, blurred, with an optional caption. No retake: the X only discards it (after a native confirmation), so a
 * user who doesn't want it doesn't have to kill the app.
 */
export function CapturePreview(props: {
  shot: Shot;
  caption: string;
  onCaption: (text: string) => void;
  sending: boolean;
  error: string | null;
  onSend: () => void;
  /** Discard the shot (after the confirmation): delete its files and close. */
  onDiscard: () => void;
  /** The shot is in the queue: the photo leaves into the roll, then `onGone` (where the screen closes). */
  sent?: boolean;
  onGone?: () => void;
  /** The moment's second shot: also blurred, in the top-left corner like the viewers' inset (only visual, no swapping). */
  inset?: CapturedPhoto | null;
}) {
  const insets = useSafeAreaInsets();
  const keyboardStyle = useKeyboardLift(insets.bottom);
  const reduceMotion = useReduceMotion();
  const exitStyle = useSendExit(props.sent ?? false, reduceMotion, props.onGone);
  const [pressed, setPressed] = useState(false);
  const busy = props.sending || !!props.sent;
  // Normal column (no absolute positioning): when the keyboard opens, the controls rise with it
  // and the photo shrinks into the remaining space, instead of being covered.
  return (
    <Animated.View style={[styles.dark, { paddingTop: insets.top }, keyboardStyle]}>
      <Pressable accessible={false} onPress={Keyboard.dismiss} style={styles.photo}>
        <Animated.View testID="sent-photo" style={[styles.photo, exitStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Descartar foto"
            disabled={busy}
            hitSlop={6}
            onPress={() =>
              Alert.alert("¿Descartar la foto?", "No se sube al rollo y no se puede recuperar.", [
                { text: "Cancelar", style: "cancel" },
                { text: "Descartar", style: "destructive", onPress: props.onDiscard },
              ])
            }
            style={styles.discard}
          >
            <SymbolView name="xmark" size={16} tintColor="#fff" />
          </Pressable>
          <Image source={{ uri: props.shot.photo.uri }} style={styles.photo} contentFit="cover" blurRadius={BLUR_RADIUS} accessible={false} />
          {props.inset && (
            <View testID="caption-inset" style={[insetFrame.frame, styles.inset, { top: spacing.sm + 44 }]}>
              <Image
                testID="caption-inset-image"
                source={{ uri: props.inset.uri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                blurRadius={BLUR_RADIUS}
                accessible={false}
              />
            </View>
          )}
        </Animated.View>
      </Pressable>

      <View style={styles.bottom}>
        <TextInput
          accessibilityLabel="Caption"
          placeholder="Agregá un caption"
          placeholderTextColor="rgba(255,255,255,0.55)"
          value={props.caption}
          onChangeText={props.onCaption}
          maxLength={140}
          editable={!busy}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          style={[type.body, styles.caption]}
        />
        {props.error && <ErrorText>{props.error}</ErrorText>}
        <View style={styles.sendRow}>
          <Text style={[type.footnote, styles.dim, styles.note]}>Después de mandarla no la ves hasta el revelado</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mandar al rollo"
            accessibilityState={{ busy, disabled: busy }}
            disabled={busy}
            onPress={props.onSend}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
          >
            {/* Feedback on press-in: a small scale (opacity only with Reduce Motion), as a CSS transition. */}
            <Animated.View
              style={[
                styles.send,
                getPressTransition(),
                {
                  opacity: busy ? 0.6 : pressed && reduceMotion !== false ? 0.8 : 1,
                  transform: [{ scale: pressed && reduceMotion === false ? 0.97 : 1 }],
                },
              ]}
            >
              <Text style={[type.headline, { color: colors.onTint }]}>{busy ? "Guardando…" : "Mandar al rollo"}</Text>
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * Once `sent`, the photo drops, shrinks and fades on the UI thread (only fades with Reduce Motion), and `onGone`
 * runs when it's over. The timer lives on the JS side so closing doesn't depend on the animation's callback.
 */
function useSendExit(sent: boolean, reduceMotion: boolean | null, onGone?: () => void) {
  const progress = useSharedValue(0);
  const { duration, scale, translateY } = sendExit(reduceMotion);
  const gone = useRef(onGone);
  gone.current = onGone;

  useEffect(() => {
    if (!sent) return;
    // ReduceMotion.Never: the reduced version is already chosen by sendExit; System would skip even the fade.
    progress.set(withTiming(1, { duration, easing: easeOut(), reduceMotion: ReduceMotion.Never }));
    const timer = setTimeout(() => gone.current?.(), duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the shot is sent
  }, [sent]);

  return useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: 1 - p,
      transform: [{ translateY: p * translateY }, { scale: 1 - p * (1 - scale) }],
    };
  });
}

/**
 * Lifts the screen with the keyboard, frame by frame on the UI thread (`useAnimatedKeyboard` reads the real keyboard
 * frame; no JS listener, so nothing lags behind it). The whole lift is the root's bottom padding, a single node: the
 * photo shrinks into the remaining space, and the resting margin turns into the keyboard gap without a jump (see
 * `bottomPadding`). Animating padding re-runs layout, acceptable here because it is the system's own keyboard motion.
 * Reduce Motion doesn't apply: following the keyboard is the system's motion, not ours.
 */
function useKeyboardLift(insetBottom: number) {
  const keyboard = useAnimatedKeyboard();
  return useAnimatedStyle(() => ({
    paddingBottom: bottomPadding(keyboard.height.get(), insetBottom, spacing.md, spacing.sm),
  }));
}

// The preview is always dark, like the camera: the photo takes the lead.
const styles = StyleSheet.create({
  discard: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.md,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  dark: { flex: 1, backgroundColor: "#000" },
  photo: { flex: 1 },
  inset: { position: "absolute", left: spacing.md },
  bottom: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  dim: { color: "rgba(255,255,255,0.75)" },
  caption: { color: "#fff", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: radius.lg, borderCurve: "continuous", paddingHorizontal: 18, minHeight: 50 },
  sendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  note: { flex: 1 },
  send: { backgroundColor: colors.tint, borderRadius: radius.full, paddingHorizontal: 22, minHeight: 52, justifyContent: "center" },
});
