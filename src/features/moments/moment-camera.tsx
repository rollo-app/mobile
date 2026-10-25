import { CameraView } from "expo-camera";
import { useRef, useState } from "react";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type * as ImagePicker from "expo-image-picker";
import { ErrorText } from "@/ui/components";
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

/** A full-screen camera with a shutter; `title` sits on top (the countdown or the selfie prompt). */
export function MomentCamera(props: {
  facing: "back" | "front";
  title: string;
  /** Only the first-shot step can be closed: once the main photo exists the only way out is sending it. */
  onClose?: () => void;
  onCapture: (asset: ImagePicker.ImagePickerAsset) => void;
}) {
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function shoot() {
    if (busy || !camera.current) return;
    setBusy(true);
    setFailed(false);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 1, exif: false });
      props.onCapture({ uri: picture.uri, width: picture.width, height: picture.height, type: "image" } as ImagePicker.ImagePickerAsset);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.dark}>
      <CameraView ref={camera} facing={props.facing} style={StyleSheet.absoluteFill} />
      <Text style={[type.headline, styles.title, { top: insets.top + spacing.md }]}>{props.title}</Text>
      {props.onClose && <CloseButton onPress={props.onClose} />}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        {failed && (
          <View style={styles.error}>
            <ErrorText>No se pudo sacar la foto. Probá de nuevo.</ErrorText>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sacar foto"
          disabled={busy}
          onPress={shoot}
          style={({ pressed }) => [styles.shutter, { opacity: busy ? 0.5 : pressed ? 0.8 : 1 }]}
        >
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: "#000" },
  title: { position: "absolute", alignSelf: "center", color: "#fff", fontVariant: ["tabular-nums"] },
  close: { position: "absolute", left: spacing.md, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  error: { marginBottom: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.5)" },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center" },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
});
