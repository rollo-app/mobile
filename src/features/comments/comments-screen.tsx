import { useCallback, useRef } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View, type ListRenderItemInfo } from "react-native";
import { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorMessage } from "@/api/client";
import { useMe } from "@/features/auth/use-me";
import { useReport } from "@/features/moderation/use-report";
import { Button, ErrorText } from "@/ui/components";
import { useKeyboardLift } from "@/ui/keyboard-lift";
import { colors, spacing, type } from "@/ui/theme";
import type { Comment } from "./actions";
import { CommentComposer } from "./comment-composer";
import { CommentRow } from "./comment-row";
import { useComments } from "./use-comments";
import { useDeleteComment } from "./use-delete-comment";

/** The comments of a photo (sheet over the viewer): the list and a field to write at the bottom. */
export function CommentsScreen({ mediaId }: { mediaId: string }) {
  const insets = useSafeAreaInsets();
  const { me } = useMe();
  const { comments, error, loading, refetch, isRefetching } = useComments(mediaId);
  const remove = useDeleteComment(mediaId);
  const { reportComment } = useReport();
  // The root's padding carries the safe area at rest and the keyboard while typing, so the field always sits above it.
  const keyboardStyle = useKeyboardLift(Math.max(insets.bottom, spacing.sm), 0, spacing.sm);

  // The row that is open, so opening another one closes it. Rows report their own swipeable when they are about to open.
  const openRow = useRef<SwipeableMethods | null>(null);
  const onSwipeOpen = useCallback((swipeable: SwipeableMethods | null) => {
    if (openRow.current && openRow.current !== swipeable) openRow.current.close();
    openRow.current = swipeable;
  }, []);

  const { mutate: removeComment } = remove;
  const onDelete = useCallback((commentId: string) => removeComment(commentId), [removeComment]);
  const onReport = useCallback((commentId: string) => void reportComment(commentId), [reportComment]);
  const myId = me?.id;
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Comment>) => (
      <CommentRow comment={item} myId={myId} onDelete={onDelete} onReport={onReport} onSwipeOpen={onSwipeOpen} />
    ),
    [myId, onDelete, onReport, onSwipeOpen],
  );

  return (
    <Animated.View style={[styles.fill, keyboardStyle]}>
      {comments ? (
        <FlatList
          data={comments}
          keyExtractor={keyExtractor}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={[type.subhead, styles.empty]}>Todavía no hay comentarios. Escribí el primero.</Text>}
          renderItem={renderItem}
          ListFooterComponent={remove.error ? <ErrorText>{errorMessage(remove.error, "No se pudo borrar")}</ErrorText> : undefined}
        />
      ) : error ? (
        <View style={styles.center}>
          <ErrorText>{error}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
        </View>
      ) : (
        loading && <ActivityIndicator style={styles.center} />
      )}

      <CommentComposer mediaId={mediaId} />
    </Animated.View>
  );
}

const keyExtractor = (c: Comment) => c.id;

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  list: { paddingVertical: spacing.md, flexGrow: 1 },
  center: { flex: 1, justifyContent: "center", gap: spacing.md, padding: spacing.lg },
  empty: { color: colors.secondaryLabel, textAlign: "center", marginTop: spacing.xl },
});
