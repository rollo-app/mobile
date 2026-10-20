import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { avatarColor, avatarUri, initialOf } from "./avatar-style";

export type AvatarSize = 40 | 72;

type Props = {
  /** Person's id (user or member): the color of the placeholder comes from it. */
  id: string;
  name: string | null | undefined;
  avatarUrl?: string | null;
  size?: AvatarSize;
  /** Local file shown instead of the server's photo while it uploads. */
  localUri?: string | null;
};

/** A person's photo, or a circle with their initial on their color when they have none. */
export function Avatar({ id, name, avatarUrl, size = 40, localUri }: Props) {
  const uri = localUri ?? avatarUri(avatarUrl);
  const box = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="avatar"
      style={[styles.box, box, { backgroundColor: avatarColor(id) }]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initialOf(name)}</Text>
      {uri && <Image testID="avatar-image" source={{ uri }} style={[StyleSheet.absoluteFill, box]} contentFit="cover" accessibilityIgnoresInvertColors />}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initial: { color: "#FFFFFF", fontWeight: "600" },
});
