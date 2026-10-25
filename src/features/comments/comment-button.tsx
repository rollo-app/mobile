import { StyleSheet, Text } from "react-native";
import { OverlayIconButton } from "@/ui/overlay-button";
import { type } from "@/ui/theme";

/** Speech bubble for the black viewer's action row, with the count next to it when there's any. */
export function CommentButton({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <OverlayIconButton
      symbol="bubble.left"
      label="Comentarios"
      value={count > 0 ? { text: count === 1 ? "1 comentario" : `${count} comentarios` } : undefined}
      onPress={onPress}
    >
      {count > 0 && <Text style={[type.subhead, styles.count]}>{count}</Text>}
    </OverlayIconButton>
  );
}

const styles = StyleSheet.create({
  count: { color: "#FFFFFF", fontVariant: ["tabular-nums"] },
});
