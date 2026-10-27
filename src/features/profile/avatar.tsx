import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { avatarColor, avatarUri, initialOf } from "./avatar-style";

export type AvatarSize = 22 | 40 | 64 | 72;

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
  const initial = initialOf(name);
  const box = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="avatar"
      style={[styles.box, box, { backgroundColor: avatarColor(id) }]}
    >
      {initial ? (
        <Text allowFontScaling={false} style={[styles.initial, { fontSize: size * 0.42 }]}>
          {initial}
        </Text>
      ) : (
        <SymbolView testID="avatar-person" name="person.fill" size={size * 0.5} tintColor="#FFFFFF" />
      )}
      {uri && <Image testID="avatar-image" source={{ uri }} style={[StyleSheet.absoluteFill, box]} contentFit="cover" accessibilityIgnoresInvertColors />}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initial: { color: "#FFFFFF", fontWeight: "600" },
});
