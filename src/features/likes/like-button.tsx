import { StyleSheet, Text } from "react-native";
import { OverlayIconButton } from "@/ui/overlay-button";
import { type } from "@/ui/theme";
import { likeRed } from "./colors";

/** Heart for the black viewers: outline, system red once you like it, and the count next to it when there's any. */
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
    <OverlayIconButton
      symbol={liked ? "heart.fill" : "heart"}
      label={liked ? "Ya no me gusta" : "Me gusta"}
      tint={liked ? likeRed : "#FFFFFF"}
      value={count > 0 ? { text: count === 1 ? "1 me gusta" : `${count} me gusta` } : undefined}
      disabled={busy}
      onPress={onPress}
    >
      {count > 0 && <Text style={[type.subhead, styles.count]}>{count}</Text>}
    </OverlayIconButton>
  );
}

const styles = StyleSheet.create({
  count: { color: "#FFFFFF", fontVariant: ["tabular-nums"] },
});
