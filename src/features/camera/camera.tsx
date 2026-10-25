import { useEffect, useMemo, useRef, useState } from "react";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Camera as VisionCamera,
  useCameraDevices,
  usePhotoOutput,
  type CameraRef,
  type CapturePhotoSettings,
} from "react-native-vision-camera";
import { ErrorText } from "@/ui/components";
import type { CapturedPhoto } from "./captured-photo";
import { ensureFourThree } from "./crop-photo";
import { bestPhotoResolution, pickCameraDevice, uprightSize } from "./device";
import { FRAME_ASPECT } from "./frame";
import { flashLabel, flashSymbol, nextFlash, type FlashMode } from "./flash";
import { activePreset, formatFactor, pinchZoom, touchDistance, zoomLevels } from "./zoom";
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

/** Every shot: the chosen flash, and the lens correction the iPhone's camera applies (ultra-wide and front). */
const captureSettings = (flash: FlashMode): CapturePhotoSettings => ({ flashMode: flash, enableDistortionCorrection: true });

/** A finger that moves less than this is a tap (focus), not a gesture. */
const TAP_SLOP = 10;

/**
 * The app's camera (VisionCamera): the preview is a full-width 3:4 frame (what the sensor's 4:3 photo really is, like the
 * iPhone's camera), with the controls on the black bands around it: "Cerrar", title and flash above, shutter and flip
 * below. Over the bottom of the frame, the zoom chips. `title` is the moment's countdown or the prompt for its second shot.
 *
 * Quality: the back camera is the multi-camera with the most lenses (iOS switches lenses while zooming), the photo output
 * asks for the device's largest 4:3 photo (48 MP where there is one) with `quality` prioritization (iOS then applies Smart
 * HDR / Deep Fusion by itself) and the session is biased to that resolution. See `device.ts` and `zoom.ts`.
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

  const targetResolution = useMemo(() => bestPhotoResolution(device?.getSupportedResolutions("photo") ?? []), [device]);
  const photoOutput = usePhotoOutput({ targetResolution, containerFormat: "jpeg", quality: 1, qualityPrioritization: "quality" });
  const outputs = useMemo(() => [photoOutput], [photoOutput]);
  const constraints = useMemo(() => [{ resolutionBias: photoOutput }], [photoOutput]);
  useEffect(() => {
    // Warms up the capture pipeline for the next shot (a 48 MP "quality" photo otherwise pays for it on the first one).
    photoOutput.prepareSettings([captureSettings(flash)]).catch(() => {});
  }, [photoOutput, flash]);

  // Zoom is raw device zoom; each device starts at its 1x (the wide lens), so flipping starts over.
  const levels = useMemo(() => (device ? zoomLevels(device) : null), [device]);
  const [zoomState, setZoomState] = useState<{ deviceId: string; zoom: number } | null>(null);
  const zoom = levels && device ? (zoomState?.deviceId === device.id ? zoomState.zoom : levels.neutral) : 1;
  const setZoom = (next: number) => device && setZoomState({ deviceId: device.id, zoom: next });
  const factor = levels ? zoom / levels.neutral : 1;
  const chip = levels ? activePreset(levels.presets, factor) : undefined;

  const touch = useRef({ startZoom: 0, startDistance: 0, x: 0, y: 0, pageX: 0, pageY: 0, gesture: false });

  async function shoot() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const photo = await photoOutput.capturePhoto(captureSettings(flash), {});
      let shot: CapturedPhoto;
      try {
        const path = await photo.saveToTemporaryFileAsync();
        shot = { uri: path.startsWith("file://") ? path : `file://${path}`, ...uprightSize(photo.width, photo.height, photo.orientation) };
      } finally {
        photo.dispose();
      }
      props.onCapture(await ensureFourThree(shot));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.dark}>
      <View testID="camera-frame" style={{ width, aspectRatio: FRAME_ASPECT, marginTop: insets.top + (props.notice ? 88 : 56), overflow: "hidden" }}>
        {device && levels && (
          <VisionCamera
            ref={camera}
            device={device}
            isActive
            outputs={outputs}
            constraints={constraints}
            zoom={zoom}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View
          testID="camera-pinch"
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onResponderGrant={(e) => {
            const { touches, locationX, locationY, pageX, pageY } = e.nativeEvent;
            touch.current = { startZoom: zoom, startDistance: touchDistance(touches), x: locationX, y: locationY, pageX, pageY, gesture: touches.length > 1 };
          }}
          onResponderMove={(e) => {
            const { touches } = e.nativeEvent;
            if (touches.length < 2) {
              // A finger lifted: the next two-finger gesture starts over from the current zoom.
              touch.current.startDistance = 0;
              const [only] = touches;
              if (only && Math.hypot(only.pageX - touch.current.pageX, only.pageY - touch.current.pageY) > TAP_SLOP) touch.current.gesture = true;
              return;
            }
            touch.current.gesture = true;
            if (!levels) return;
            if (touch.current.startDistance <= 0) touch.current = { ...touch.current, startZoom: zoom, startDistance: touchDistance(touches) };
            setZoom(pinchZoom(levels, touch.current.startZoom, touch.current.startDistance, touchDistance(touches)));
          }}
          onResponderRelease={() => {
            if (touch.current.gesture || !device?.supportsFocusMetering) return;
            camera.current?.focusTo({ x: touch.current.x, y: touch.current.y }).catch(() => {});
          }}
        />
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
                  onPress={() => setZoom(preset * levels.neutral)}
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
      </View>
      <Text style={[type.headline, styles.title, { top: insets.top + spacing.md }]}>{props.title}</Text>
      {props.notice ? <Text style={[type.subhead, styles.notice, { top: insets.top + spacing.md + 28 }]}>{props.notice}</Text> : null}
      {props.onClose && <CloseButton onPress={props.onClose} />}
      <View style={[styles.flash, { top: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={flashLabel[flash]}
          hitSlop={12}
          onPress={() => setFlash(nextFlash)}
          style={styles.round}
        >
          <SymbolView name={flashSymbol[flash]} size={22} tintColor="#fff" />
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
            accessibilityLabel="Sacar foto"
            disabled={busy}
            onPress={shoot}
            style={({ pressed }) => [styles.shutter, { opacity: busy ? 0.5 : pressed ? 0.8 : 1 }]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <View style={styles.side}>
            {props.onFlip && (
              <Pressable accessibilityRole="button" accessibilityLabel="Dar vuelta la cámara" hitSlop={12} onPress={props.onFlip} style={styles.round}>
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
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  flash: { position: "absolute", right: spacing.md },
  close: { position: "absolute", left: spacing.md, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  zoomRow: { position: "absolute", bottom: spacing.md, left: 0, right: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.sm },
  zoomChip: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  zoomChipActive: { width: 38, height: 38, borderRadius: 19 },
  zoomText: { color: "#fff", fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  error: { marginBottom: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.5)" },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center" },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
});
