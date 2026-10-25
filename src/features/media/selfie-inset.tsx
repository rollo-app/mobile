import { Image } from "expo-image";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { insetFrame } from "@/ui/inset-frame";
import { mediaSource, type RevealedPhoto } from "./revealed";

/**
 * The small picture of a moment: the linked image while the main is big, the main while the linked one is big.
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
  /** The linked image is the big picture now (so the inset shows the main). */
  selfieBig: boolean;
  onToggle: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  if (!photo.selfie) return null;
  const path = selfieBig ? photo.thumbPath : photo.selfie.thumbPath;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ver la otra foto"
      onPress={onToggle}
      // A hold on it doesn't pause a story behind it.
      onLongPress={() => {}}
      style={({ pressed }) => [insetFrame.frame, style, pressed && styles.pressed]}
    >
      <Image source={mediaSource(path, token)} contentFit="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
});
