import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text } from "react-native";
import { spacing, type } from "@/ui/theme";
import { likeRed } from "./colors";

/** "Me gusta" pill for the black viewers: heart (system red once you like it) and the count when there's any. */
export function LikeButton({
  liked,
  count,
  busy,
  onPress,
}: {
  liked: boolean;
  count: number;
  busy?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Me gusta"
      accessibilityValue={count > 0 ? { text: count === 1 ? "1 me gusta" : `${count} me gusta` } : undefined}
      accessibilityState={{ selected: liked, busy: !!busy }}
      disabled={busy}
      onPress={onPress}
      style={styles.pill}
    >
      <SymbolView name={liked ? "heart.fill" : "heart"} size={15} tintColor={liked ? likeRed : "#FFFFFF"} />
      {count > 0 && <Text style={[type.subhead, styles.count]}>{count}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  count: { color: "#FFFFFF", fontVariant: ["tabular-nums"] },
});
