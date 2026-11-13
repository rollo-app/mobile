import { MenuView, type MenuAction } from "@expo/ui/community/menu";
import { SymbolView } from "expo-symbols";
import { memo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { Avatar } from "@/features/profile/avatar";
import { colors, spacing, type } from "@/ui/theme";
import type { Comment } from "./actions";
import { formatAgo } from "./relative-time";

const DELETE_WIDTH = 80;

// The menu is only for reporting someone else's comment; deleting is the swipe.
const REPORT_MENU: MenuAction[] = [{ id: "report", title: "Denunciar", image: "exclamationmark.bubble" }];

type Props = {
  comment: Comment;
  /** The signed-in user's id, to tell your own comments (no report menu). */
  myId: string | undefined;
  onDelete: (commentId: string) => void;
  onReport: (commentId: string) => void;
  /** Called when this row's swipe is about to open, so the screen can close the one that was open. */
  onSwipeOpen: (swipeable: SwipeableMethods | null) => void;
};

/** One comment. Memoized: it only re-renders when its comment or the (stable) callbacks change. */
export const CommentRow = memo(function CommentRow({ comment, myId, onDelete, onReport, onSwipeOpen }: Props) {
  const swipeable = useRef<SwipeableMethods | null>(null);
  const showMenu = comment.author.userId !== myId;
  const row = (
    <View
      testID={`comment-${comment.id}`}
      style={[styles.row, styles.rowBackground]}
      accessibilityActions={comment.canDelete ? [{ name: "delete", label: "Borrar" }] : undefined}
      onAccessibilityAction={comment.canDelete ? () => onDelete(comment.id) : undefined}
    >
      <Avatar id={comment.author.userId} name={comment.author.name} avatarUrl={comment.author.avatarUrl} size={40} />
      <View style={styles.body}>
        <Text style={type.subhead}>
          <Text style={styles.name}>{comment.author.name}</Text>
          <Text style={styles.ago}>{`  ${formatAgo(comment.createdAt)}`}</Text>
        </Text>
        <Text style={[type.body, styles.text]} selectable>
          {comment.text}
        </Text>
      </View>
      {showMenu && (
        <MenuView actions={REPORT_MENU} onPressAction={() => onReport(comment.id)}>
          <View accessibilityRole="button" accessibilityLabel="Más opciones" style={styles.more}>
            <SymbolView name="ellipsis" size={16} tintColor={colors.secondaryLabel as string} />
          </View>
        </MenuView>
      )}
    </View>
  );
  if (!comment.canDelete) return row;
  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      overshootRight={false}
      rightThreshold={DELETE_WIDTH / 2}
      onSwipeableWillOpen={() => onSwipeOpen(swipeable.current)}
      renderRightActions={() => (
        <Pressable accessibilityRole="button" accessibilityLabel="Borrar" onPress={() => onDelete(comment.id)} style={styles.delete}>
          <SymbolView name="trash" size={20} tintColor="#FFFFFF" />
        </Pressable>
      )}
    >
      {row}
    </ReanimatedSwipeable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rowBackground: { backgroundColor: colors.background },
  delete: { width: DELETE_WIDTH, alignItems: "center", justifyContent: "center", backgroundColor: colors.danger },
  body: { flex: 1, gap: 2 },
  name: { fontWeight: "600", color: colors.label },
  ago: { color: colors.secondaryLabel },
  text: { color: colors.label },
  more: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
});
