import { CameraView } from "expo-camera";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type * as ImagePicker from "expo-image-picker";
import { spacing, type } from "@/ui/theme";

/** A full-screen camera with a shutter; `title` sits on top (the countdown or the selfie prompt). */
export function MomentCamera(props: {
  facing: "back" | "front";
  title: string;
  onCapture: (asset: ImagePicker.ImagePickerAsset) => void;
}) {
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);

  async function shoot() {
    if (busy || !camera.current) return;
    setBusy(true);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 1, exif: false });
      props.onCapture({ uri: picture.uri, width: picture.width, height: picture.height, type: "image" } as ImagePicker.ImagePickerAsset);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.dark}>
      <CameraView ref={camera} facing={props.facing} style={StyleSheet.absoluteFill} />
      <Text style={[type.headline, styles.title, { top: insets.top + spacing.md }]}>{props.title}</Text>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
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
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center" },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
});
