import { useState } from "react";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { cubicBezier, type CSSTransitionProperties } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera as VisionCamera } from "react-native-vision-camera";
import { ErrorText } from "@/ui/components";
import { EASE_OUT_BEZIER } from "@/ui/motion";
import { useReduceMotion } from "@/ui/use-reduce-motion";
import type { CapturedPhoto } from "./captured-photo";
import { formatBias, sunOffset } from "./exposure";
import { FRAME_ASPECT } from "./frame";
import { flashLabel, flashSymbol, nextFlash, type FlashMode } from "./flash";
import { timerLabel } from "./timer";
import { useCameraExposure } from "./use-camera-exposure";
import { useCameraGrid } from "./use-camera-grid";
import { useCameraSession } from "./use-camera-session";
import { useCameraTouch } from "./use-camera-touch";
import { useCameraZoom } from "./use-camera-zoom";
import { useSelfTimer } from "./use-self-timer";
import { useTakePhoto } from "./use-take-photo";
import { expandTarget, formatFactor } from "./zoom";
import { spacing, tintHex, type } from "@/ui/theme";

/** The round "Cerrar" over a dark screen. */
export function CloseButton(props: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Cerrar"
      hitSlop={12}
      onPress={props.onPress}
      style={[styles.close, { top: insets.top + spacing.sm }]}
    >
      <SymbolView name="xmark" size={18} tintColor="#fff" />
    </Pressable>
  );
}

/** The focus square's side, and how far the exposure sun travels each way along its line. */
const FOCUS_SIZE = 72;
const SUN_TRAVEL = 44;

// Built on first use, never at import: route test suites mock Reanimated as an empty object.
let shutterTransition: CSSTransitionProperties | undefined;
const getShutterTransition = (pressed: boolean): CSSTransitionProperties => ({
  ...(shutterTransition ??= { transitionProperty: ["transform"], transitionTimingFunction: cubicBezier(...EASE_OUT_BEZIER) }),
  // Asymmetric: the press lands fast, the release settles.
  transitionDuration: pressed ? 100 : 200,
});

/** The top band: one row of round controls (Cerrar left; flash, timer, grid right), the title and notice under it. */
const CONTROL = 36;
const TOP_ROW = spacing.sm + CONTROL + spacing.sm;

/**
 * The app's camera (VisionCamera): the preview is a full-width 3:4 frame (what the sensor's 4:3 photo really is, like the
 * iPhone's camera), with the controls on the black bands around it: "Cerrar" and flash / timer / grid above (the title
 * and notice under them), shutter and flip below. Over the bottom of the frame, the zoom chips (back) or "Ampliar
 * encuadre" (front). `title` is the moment's countdown or the prompt for its second shot.
 *
 * Quality: the back camera is the multi-camera with the most lenses (iOS switches lenses while zooming), the photo output
 * asks for the device's largest 4:3 photo up to ~24 MP with `quality` prioritization (iOS then applies Smart
 * HDR / Deep Fusion by itself) and the session is biased to that resolution; low-light boost is on where the device has
 * it. See `device.ts`, `zoom.ts` and `exposure.ts`.
 */
export function Camera(props: {
  facing: "back" | "front";
  title: string;
  /** A line under the title (what the two shots are for). */
  notice?: string;
  /** Flips the camera: only before the first photo. */
  onFlip?: () => void;
  /** Only the first-shot step can be closed: once the main photo exists the only way out is sending it. */
  onClose?: () => void;
  onCapture: (photo: CapturedPhoto) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [flash, setFlash] = useState<FlashMode>("auto");
  const reduceMotion = useReduceMotion();
  const { grid, toggleGrid } = useCameraGrid();
  const { camera, device, photoOutput, outputs, constraints, session, onStarted, onError } = useCameraSession(props.facing, flash);
  const zoomControl = useCameraZoom({ camera, device, session, onError });
  const { levels, zoom, factor, chip, expand, expanded, applyZoom } = zoomControl;
  const exposure = useCameraExposure({ camera, device, reduceMotion });
  const { range, focus, bias, onExposureAction, focusStyle } = exposure;
  const touchHandlers = useCameraTouch(zoomControl, exposure);
  const { busy, failed, shoot, blinkStyle } = useTakePhoto({ photoOutput, device, flash, onCapture: props.onCapture });
  const { timer, cycleTimer, countdown, onShutter } = useSelfTimer(shoot);

  const topBand = TOP_ROW + (props.title ? 24 : 0) + (props.notice ? 44 : 0);

  return (
    <View style={styles.dark}>
      <View testID="camera-frame" style={{ width, aspectRatio: FRAME_ASPECT, marginTop: insets.top + Math.max(56, topBand), overflow: "hidden" }}>
        {device && levels && (
          <VisionCamera
            ref={camera}
            device={device}
            isActive
            outputs={outputs}
            constraints={constraints}
            mirrorMode="auto"
            zoom={levels.neutral}
            exposure={range ? bias : undefined}
            // Only where supported: VisionCamera's `configure` throws for any value (even false) on a device without it.
            enableLowLightBoost={device.supportsLowLightBoost ? true : undefined}
            onStarted={onStarted}
            onError={onError}
            style={StyleSheet.absoluteFill}
          />
        )}
        {grid && (
          <View testID="camera-grid" style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={[styles.gridLine, styles.gridV, { left: "33.333%" }]} />
            <View style={[styles.gridLine, styles.gridV, { left: "66.667%" }]} />
            <View style={[styles.gridLine, styles.gridH, { top: "33.333%" }]} />
            <View style={[styles.gridLine, styles.gridH, { top: "66.667%" }]} />
          </View>
        )}
        <Animated.View testID="shutter-blink" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.blink, blinkStyle]} />
        <View
          testID="camera-pinch"
          style={StyleSheet.absoluteFill}
          {...touchHandlers}
        />
        {focus && (
          <Animated.View
            testID="focus-square"
            pointerEvents="none"
            style={[styles.focus, { left: focus.x - FOCUS_SIZE / 2, top: focus.y - FOCUS_SIZE / 2 }, focusStyle]}
          >
            {range && (
              <View
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel="Exposición"
                accessibilityValue={{ text: formatBias(bias) }}
                accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
                onAccessibilityAction={onExposureAction}
                // The sun goes to the right of the square, or to its left near the right edge.
                style={[styles.sunTrack, focus.x + FOCUS_SIZE / 2 + 34 > width ? { right: FOCUS_SIZE + 4 } : { left: FOCUS_SIZE + 4 }]}
              >
                <View style={[styles.sunLine, { opacity: bias === 0 ? 0 : 1 }]} />
                <View style={[styles.sun, { transform: [{ translateY: sunOffset(range, bias, SUN_TRAVEL) }] }]}>
                  <SymbolView name="sun.max.fill" size={18} tintColor={tintHex.dark} />
                </View>
              </View>
            )}
          </Animated.View>
        )}
        {countdown !== null && countdown > 0 && (
          <View style={styles.countdownWrap} pointerEvents="none">
            <Text testID="timer-countdown" accessibilityLiveRegion="polite" style={styles.countdown}>
              {countdown}
            </Text>
          </View>
        )}
        {levels && levels.presets.length > 0 && (
          <View testID="zoom-chips" style={styles.zoomRow} pointerEvents="box-none">
            {levels.presets.map((preset) => {
              const active = preset === chip;
              return (
                <Pressable
                  key={preset}
                  accessibilityRole="button"
                  accessibilityLabel={`Zoom ${formatFactor(preset)}×`}
                  accessibilityState={{ selected: active }}
                  hitSlop={6}
                  onPress={() => applyZoom(preset * levels.neutral, true)}
                  style={[styles.zoomChip, active && styles.zoomChipActive]}
                >
                  <Text style={[styles.zoomText, active && { color: tintHex.dark }]}>
                    {active ? `${formatFactor(factor)}×` : formatFactor(preset)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {expand && (
          <View style={styles.zoomRow} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={expanded ? "Reducir encuadre" : "Ampliar encuadre"}
              hitSlop={8}
              onPress={() => applyZoom(expandTarget(expand, zoom), true)}
              style={styles.round}
            >
              <SymbolView
                name={expanded ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right"}
                size={16}
                tintColor="#fff"
              />
            </Pressable>
          </View>
        )}
      </View>
      {props.title ? <Text style={[type.headline, styles.title, { top: insets.top + TOP_ROW }]}>{props.title}</Text> : null}
      {props.notice ? (
        <Text style={[type.subhead, styles.notice, { top: insets.top + TOP_ROW + (props.title ? 24 : 0) }]}>{props.notice}</Text>
      ) : null}
      {props.onClose && <CloseButton onPress={props.onClose} />}
      <View style={[styles.topRight, { top: insets.top + spacing.sm }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={flashLabel[flash]} hitSlop={6} onPress={() => setFlash(nextFlash)} style={styles.round}>
          <SymbolView name={flashSymbol[flash]} size={18} tintColor="#fff" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={timerLabel(timer)}
          accessibilityState={{ selected: timer > 0 }}
          hitSlop={6}
          onPress={cycleTimer}
          style={[styles.round, timer > 0 && styles.pill]}
        >
          <SymbolView name="timer" size={18} tintColor={timer > 0 ? tintHex.dark : "#fff"} />
          {timer > 0 && <Text style={styles.pillText}>{`${timer}s`}</Text>}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cuadrícula"
          accessibilityState={{ selected: grid }}
          hitSlop={6}
          onPress={toggleGrid}
          style={styles.round}
        >
          <SymbolView name="grid" size={18} tintColor={grid ? tintHex.dark : "#fff"} />
        </Pressable>
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        {failed && (
          <View style={styles.error}>
            <ErrorText>No se pudo sacar la foto. Probá de nuevo.</ErrorText>
          </View>
        )}
        <View style={styles.shutterRow}>
          <View style={[styles.side, styles.left]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={countdown !== null ? "Cancelar temporizador" : "Sacar foto"}
            disabled={busy}
            onPress={onShutter}
            style={({ pressed }) => [styles.shutter, { opacity: busy ? 0.5 : pressed ? 0.8 : 1 }]}
          >
            {({ pressed }) => (
            <Animated.View
              style={[
                countdown !== null ? styles.shutterStop : styles.shutterInner,
                getShutterTransition(pressed),
                { transform: [{ scale: pressed && reduceMotion === false ? 0.9 : 1 }] },
              ]}
            />
          )}
          </Pressable>
          <View style={styles.side}>
            {props.onFlip && (
              <Pressable accessibilityRole="button" accessibilityLabel="Dar vuelta la cámara" hitSlop={12} onPress={props.onFlip} style={styles.flip}>
                <SymbolView name="arrow.triangle.2.circlepath.camera" size={22} tintColor="#fff" />
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: "#000" },
  title: { position: "absolute", alignSelf: "center", color: "#fff", fontVariant: ["tabular-nums"] },
  notice: { position: "absolute", alignSelf: "center", color: "#fff", textAlign: "center", paddingHorizontal: spacing.lg },
  shutterRow: { flexDirection: "row", alignItems: "center", alignSelf: "stretch", paddingHorizontal: spacing.lg },
  side: { flex: 1, alignItems: "flex-end" },
  left: { alignItems: "flex-start" },
  round: {
    minWidth: CONTROL,
    height: CONTROL,
    borderRadius: CONTROL / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  pill: { flexDirection: "row", gap: 2, paddingHorizontal: spacing.sm },
  pillText: { color: tintHex.dark, fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },
  flip: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  topRight: { position: "absolute", right: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  close: {
    position: "absolute",
    left: spacing.md,
    width: CONTROL,
    height: CONTROL,
    borderRadius: CONTROL / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  zoomRow: { position: "absolute", bottom: spacing.md, left: 0, right: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.sm },
  zoomChip: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  zoomChipActive: { width: 38, height: 38, borderRadius: 19 },
  zoomText: { color: "#fff", fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  gridLine: { position: "absolute", backgroundColor: "rgba(255,255,255,0.45)" },
  gridV: { top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  gridH: { left: 0, right: 0, height: StyleSheet.hairlineWidth },
  blink: { backgroundColor: "#000" },
  focus: { position: "absolute", width: FOCUS_SIZE, height: FOCUS_SIZE, borderWidth: 1, borderColor: tintHex.dark },
  sunTrack: { position: "absolute", top: FOCUS_SIZE / 2 - SUN_TRAVEL - 12, width: 24, height: SUN_TRAVEL * 2 + 24, alignItems: "center", justifyContent: "center" },
  sunLine: { position: "absolute", top: 12, bottom: 12, width: 1, backgroundColor: tintHex.dark },
  sun: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  countdownWrap: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  countdown: { color: "#fff", fontSize: 120, fontWeight: "200", fontVariant: ["tabular-nums"] },
  error: { marginBottom: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.5)" },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center" },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
  shutterStop: { width: 28, height: 28, borderRadius: 6, backgroundColor: "#fff" },
});
