import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet } from "react-native";

export function RoundButton({
  symbol,
  label,
  onPress,
}: {
  symbol: "speaker.slash.fill" | "speaker.wave.2.fill";
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.round, { opacity: pressed ? 0.6 : 1 }]}
    >
      <SymbolView name={symbol} size={16} tintColor="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  round: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
});
