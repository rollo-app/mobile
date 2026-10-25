import { SymbolView } from "expo-symbols";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

const SIZE = 22;

/** Marks the photo of a daily moment: a white bolt on a dark circle, same size as the featured author badge. */
export function MomentBadge({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View testID="moment-badge" accessible accessibilityLabel="Foto del momento" style={[styles.badge, style]}>
      <SymbolView name="bolt.fill" size={12} tintColor="#FFFFFF" />
    </View>
  );
}

/** Bottom-left corner of a thumbnail (where the featured grid puts its author badge). */
export const momentBadgeCorner: ViewStyle = { position: "absolute", left: 4, bottom: 4 };

const styles = StyleSheet.create({
  badge: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
});
