import { CameraView } from "expo-camera";
import { useRef, useState } from "react";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErrorText } from "@/ui/components";
import type { CapturedPhoto } from "./captured-photo";
import { ensureFourThree } from "./crop-photo";
import { FRAME_ASPECT } from "./frame";
import { flashLabel, flashSymbol, nextFlash, type FlashMode } from "./flash";
import { pinchZoom, touchDistance } from "./pinch-zoom";
import { spacing, type } from "@/ui/theme";

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
 * The app's camera: the preview is a full-width 3:4 frame (what the sensor's 4:3 photo really is, like the iPhone's camera),
 * with the controls on the black bands around it: "Cerrar", title and flash above, shutter and flip below. Pinch to zoom
 * works on the frame. `title` is the moment's countdown or the prompt for its second shot.
 *
 * expo-camera on iOS takes the photo with the `photo` preset (the sensor's largest 4:3, the default `pictureSize`) and
 * crops it to the view's aspect, so a 3:4 view gives exactly what the frame shows, at full resolution, on both cameras.
 * `ratio` is Android-only and `getAvailablePictureSizesAsync` is a fixed list on iOS, so neither is used.
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
  const camera = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [flash, setFlash] = useState<FlashMode>("auto");
  const [zoom, setZoom] = useState(0);
  const pinch = useRef({ startZoom: 0, startDistance: 0 });

  async function shoot() {
    if (busy || !camera.current) return;
    setBusy(true);
    setFailed(false);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 1, exif: false });
      props.onCapture(await ensureFourThree({ uri: picture.uri, width: picture.width, height: picture.height }));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.dark}>
      <View testID="camera-frame" style={{ width, aspectRatio: FRAME_ASPECT, marginTop: insets.top + (props.notice ? 88 : 56), overflow: "hidden" }}>
        <CameraView ref={camera} facing={props.facing} flash={flash} zoom={zoom} style={StyleSheet.absoluteFill} />
        <View
          testID="camera-pinch"
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onResponderGrant={(e) => {
            pinch.current = { startZoom: zoom, startDistance: touchDistance(e.nativeEvent.touches) };
          }}
          onResponderMove={(e) => {
            const { touches } = e.nativeEvent;
            if (touches.length < 2) {
              // A finger lifted: the next two-finger gesture starts over from the current zoom.
              pinch.current.startDistance = 0;
              return;
            }
            if (pinch.current.startDistance <= 0) pinch.current = { startZoom: zoom, startDistance: touchDistance(touches) };
            setZoom(pinchZoom(pinch.current.startZoom, pinch.current.startDistance, touchDistance(touches)));
          }}
        />
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
  error: { marginBottom: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.5)" },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center" },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
});
