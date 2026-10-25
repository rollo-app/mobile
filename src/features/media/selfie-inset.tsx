import { Image } from "expo-image";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { mediaSource, type RevealedPhoto } from "./revealed";

const SIZE = 72;

/**
 * The small picture of a moment: the selfie while the photo is big, the photo while the selfie is big.
 * Tapping it swaps the two.
 */
export function SelfieInset({
  photo,
  token,
  selfieBig,
  onToggle,
  style,
}: {
  photo: Pick<RevealedPhoto, "thumbPath" | "selfie">;
  token: string;
  /** The selfie is the big picture now (so the inset shows the photo). */
  selfieBig: boolean;
  onToggle: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  if (!photo.selfie) return null;
  const path = selfieBig ? photo.thumbPath : photo.selfie.thumbPath;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={selfieBig ? "Ver la foto" : "Ver la selfie"}
      onPress={onToggle}
      // A hold on it doesn't pause a story behind it.
      onLongPress={() => {}}
      style={({ pressed }) => [styles.inset, style, pressed && styles.pressed]}
    >
      <Image source={mediaSource(path, token)} contentFit="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inset: {
    width: SIZE,
    height: SIZE * 1.33,
    borderRadius: 10,
    borderCurve: "continuous",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    overflow: "hidden",
    backgroundColor: "#222",
  },
  pressed: { opacity: 0.7 },
});
