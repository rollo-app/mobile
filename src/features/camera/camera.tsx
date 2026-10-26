import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type AccessibilityActionEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Camera as VisionCamera,
  useCameraDevices,
  usePhotoOutput,
  type CameraRef,
  type CapturePhotoSettings,
} from "react-native-vision-camera";
import { ErrorText } from "@/ui/components";
import { loadCameraGrid, saveCameraGrid } from "@/storage/camera-grid";
import type { CapturedPhoto } from "./captured-photo";
import { ensureFourThree } from "./crop-photo";
import { bestPhotoResolution, pickCameraDevice, uprightSize } from "./device";
import { biasRange, dragBias, formatBias, meteringModes, stepBias, sunOffset } from "./exposure";
import { FRAME_ASPECT } from "./frame";
import { flashLabel, flashSymbol, nextFlash, type FlashMode } from "./flash";
import { nextTimer, timerLabel, type TimerDelay } from "./timer";
import { activePreset, expandTarget, formatFactor, frontExpand, isExpanded, pinchZoom, touchDistance, zoomLevels } from "./zoom";
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

/**
 * Every shot: the chosen flash. No `enableDistortionCorrection`: VisionCamera 5.2.3 sets it per shot without enabling
 * it on the photo output, and AVFoundation throws inside capturePhoto (a native crash).
 */
const captureSettings = (flash: FlashMode): CapturePhotoSettings => ({ flashMode: flash });

/** How fast a chip tap ramps the zoom (AVFoundation's rate: doublings per second), about 0.2 s from 1× to 3×. */
const ZOOM_RAMP_RATE = 8;

/** A finger that moves less than this is a tap (focus), not a gesture. */
const TAP_SLOP = 10;

/** The focus square's side, and how far the exposure sun travels each way along its line. */
const FOCUS_SIZE = 72;
const SUN_TRAVEL = 44;

/** The focus square dims this long after the last touch, like the iPhone's. */
const FOCUS_DIM_MS = 2000;

/** The top band: one row of round controls (Cerrar left; flash, timer, grid right), the title and notice under it. */
const CONTROL = 36;
const TOP_ROW = spacing.sm + CONTROL + spacing.sm;

type FocusPoint = { deviceId: string; x: number; y: number };

/** The timer's tick each second. */
const tick = () => {
  Promise.resolve(Haptics.selectionAsync()).catch(() => {});
};

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
  const camera = useRef<CameraRef>(null);
  const devices = useCameraDevices();
  const device = pickCameraDevice(devices, props.facing);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [flash, setFlash] = useState<FlashMode>("auto");
  const [timer, setTimer] = useState<TimerDelay>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [grid, setGrid] = useState(false);

  useEffect(() => {
    let live = true;
    loadCameraGrid()
      .then((on) => {
        if (live && on) setGrid(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  function toggleGrid() {
    const next = !grid;
    setGrid(next);
    saveCameraGrid(next).catch(() => {});
  }

  const targetResolution = useMemo(() => bestPhotoResolution(device?.getSupportedResolutions("photo") ?? []), [device]);
  const photoOutput = usePhotoOutput({ targetResolution, containerFormat: "jpeg", quality: 1, qualityPrioritization: "quality" });
  const outputs = useMemo(() => [photoOutput], [photoOutput]);
  const constraints = useMemo(() => [{ resolutionBias: photoOutput }], [photoOutput]);
  // The running session (after `onStarted`): its controller knows the active format's real zoom range, and how iOS
  // displays its zoom (`displayableZoomFactor / zoom`: where the front camera's 1× is on iPhones that can expand it).
  const [running, setRunning] = useState<{ deviceId: string; minZoom: number; maxZoom: number; multiplier: number } | null>(null);
  const session = running && device && running.deviceId === device.id ? running : null;
  useEffect(() => {
    // Warms up the capture pipeline once the outputs are configured, so the first "quality" shot doesn't pay for it.
    if (session) photoOutput.prepareSettings([captureSettings(flash)]).catch(() => {});
  }, [session, photoOutput, flash]);

  const warned = useRef(false);
  const onError = useCallback((error: Error) => {
    // A rejected zoom or a session hiccup: not worth an error screen (or LogBox), but worth one line in the log.
    if (warned.current) return;
    warned.current = true;
    console.warn(`Cámara: ${error.message}`);
  }, []);

  // Zoom is raw device zoom; each device starts at its 1x (the wide lens), so flipping starts over. The `zoom` prop only
  // sets that start: pinch, chips and "Ampliar encuadre" drive the controller directly (with a ramp, like the iPhone).
  const levels = useMemo(
    () =>
      device
        ? zoomLevels({
            position: device.position,
            minZoom: Math.max(device.minZoom, session?.minZoom ?? 0),
            maxZoom: Math.min(device.maxZoom, session?.maxZoom ?? Infinity),
            zoomLensSwitchFactors: device.zoomLensSwitchFactors,
            physicalDevices: device.physicalDevices,
            displayMultiplier: session?.multiplier,
          })
        : null,
    [device, session],
  );
  const [zoomState, setZoomState] = useState<{ deviceId: string; zoom: number } | null>(null);
  const zoom = levels && device ? (zoomState?.deviceId === device.id ? zoomState.zoom : levels.neutral) : 1;
  const factor = levels ? zoom / levels.neutral : 1;
  const chip = levels ? activePreset(levels.presets, factor) : undefined;
  const expand = levels && device && session ? frontExpand(levels, device.position) : null;

  function applyZoom(next: number, ramp: boolean) {
    if (!device || !session) return;
    setZoomState({ deviceId: device.id, zoom: next });
    try {
      const done = ramp ? camera.current?.startZoomAnimation(next, ZOOM_RAMP_RATE) : camera.current?.controller?.setZoom(next);
      done?.catch(onError);
    } catch (error) {
      onError(error as Error);
    }
  }

  // Exposure: a tap meters there (focus + exposure + white balance) and resets the bias; dragging afterwards biases it.
  // Both belong to one device: flipping (or remounting) starts over with no point and 0 EV.
  const range = device ? biasRange(device) : null;
  const [focusState, setFocusState] = useState<FocusPoint | null>(null);
  const focus = focusState && device && focusState.deviceId === device.id ? focusState : null;
  const [biasState, setBiasState] = useState<{ deviceId: string; bias: number } | null>(null);
  const bias = biasState && device && biasState.deviceId === device.id ? biasState.bias : 0;
  const [dim, setDim] = useState(false);
  useEffect(() => {
    if (!focus) return;
    setDim(false);
    const t = setTimeout(() => setDim(true), FOCUS_DIM_MS);
    return () => clearTimeout(t);
  }, [focus, bias]);

  function setBias(next: number) {
    if (device) setBiasState({ deviceId: device.id, bias: next });
  }

  function focusAt(x: number, y: number) {
    if (!device) return;
    setFocusState({ deviceId: device.id, x, y });
    setBias(0);
    const modes = meteringModes(device);
    if (modes.length === 0) return;
    try {
      camera.current?.focusTo({ x, y }, { modes, autoResetAfter: null }).catch(() => {});
    } catch {
      // Not running yet: the square still shows where the user tapped.
    }
  }

  function onExposureAction(event: AccessibilityActionEvent) {
    if (!range) return;
    const { actionName } = event.nativeEvent;
    if (actionName === "increment") setBias(stepBias(range, bias, 1));
    if (actionName === "decrement") setBias(stepBias(range, bias, -1));
  }

  const touch = useRef({ startZoom: 0, startDistance: 0, startBias: 0, x: 0, y: 0, pageX: 0, pageY: 0, gesture: false, pinched: false, exposure: false });

  async function shoot() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const photo = await photoOutput.capturePhoto(captureSettings(flash), {});
      let shot: CapturedPhoto;
      const mirrored = photo.isMirrored;
      try {
        const path = await photo.saveToTemporaryFileAsync();
        shot = { uri: path.startsWith("file://") ? path : `file://${path}`, ...uprightSize(photo.width, photo.height, photo.orientation) };
      } finally {
        photo.dispose();
      }
      props.onCapture(await ensureFourThree(shot, { mirrored }));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  // The self-timer: the shutter starts the countdown (or cancels it), each second ticks, and at 0 it shoots.
  const shootRef = useRef(shoot);
  shootRef.current = shoot;
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      void shootRef.current();
      return;
    }
    const t = setTimeout(() => {
      if (countdown > 1) tick();
      setCountdown(countdown - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function onShutter() {
    if (countdown !== null) {
      setCountdown(null);
      return;
    }
    if (timer === 0) {
      void shoot();
      return;
    }
    tick();
    setCountdown(timer);
  }

  const topBand = TOP_ROW + (props.title ? 24 : 0) + (props.notice ? 44 : 0);
  const expanded = expand ? isExpanded(expand, zoom) : false;

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
            onStarted={() => {
              const controller = camera.current?.controller;
              if (!controller) return;
              const multiplier = controller.zoom > 0 ? controller.displayableZoomFactor / controller.zoom : 1;
              setRunning({ deviceId: device.id, minZoom: controller.minZoom, maxZoom: controller.maxZoom, multiplier });
            }}
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
        <View
          testID="camera-pinch"
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onResponderGrant={(e) => {
            const { touches, locationX, locationY, pageX, pageY } = e.nativeEvent;
            const pinching = touches.length > 1;
            touch.current = {
              startZoom: zoom,
              startDistance: touchDistance(touches),
              startBias: bias,
              x: locationX,
              y: locationY,
              pageX,
              pageY,
              gesture: pinching,
              pinched: pinching,
              exposure: false,
            };
          }}
          onResponderMove={(e) => {
            const { touches } = e.nativeEvent;
            const t = touch.current;
            if (touches.length < 2) {
              // A finger lifted: the next two-finger gesture starts over from the current zoom.
              t.startDistance = 0;
              const [only] = touches;
              if (!only) return;
              const dx = only.pageX - t.pageX;
              const dy = only.pageY - t.pageY;
              if (Math.hypot(dx, dy) > TAP_SLOP) {
                t.gesture = true;
                // One finger moving up or down after a tap is the exposure, like the iPhone (never the end of a pinch).
                if (!t.pinched && focus && range && Math.abs(dy) > Math.abs(dx)) t.exposure = true;
              }
              if (t.exposure && range) setBias(dragBias(range, t.startBias, dy));
              return;
            }
            t.gesture = true;
            t.pinched = true;
            t.exposure = false;
            if (!levels) return;
            if (t.startDistance <= 0) touch.current = { ...t, startZoom: zoom, startDistance: touchDistance(touches) };
            applyZoom(pinchZoom(levels, touch.current.startZoom, touch.current.startDistance, touchDistance(touches)), false);
          }}
          onResponderRelease={() => {
            if (touch.current.gesture) return;
            focusAt(touch.current.x, touch.current.y);
          }}
        />
        {focus && (
          <View
            testID="focus-square"
            pointerEvents="none"
            style={[styles.focus, { left: focus.x - FOCUS_SIZE / 2, top: focus.y - FOCUS_SIZE / 2, opacity: dim ? 0.5 : 1 }]}
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
          </View>
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
          onPress={() => setTimer(nextTimer)}
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
            <View style={countdown !== null ? styles.shutterStop : styles.shutterInner} />
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
