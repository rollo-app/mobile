import { MenuView, type MenuAction } from "@expo/ui/community/menu";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorMessage } from "@/api/client";
import { useMe } from "@/features/auth/use-me";
import { useReport } from "@/features/moderation/use-report";
import { Avatar } from "@/features/profile/avatar";
import { Button, ErrorText } from "@/ui/components";
import { useKeyboardLift } from "@/ui/keyboard-lift";
import { colors, spacing, type } from "@/ui/theme";
import type { Comment } from "./actions";
import { canSend, cleanDraft, COMMENT_MAX_LENGTH } from "./draft";
import { formatAgo } from "./relative-time";
import { useAddComment } from "./use-add-comment";
import { useComments } from "./use-comments";
import { useDeleteComment } from "./use-delete-comment";

const DELETE_WIDTH = 80;

/** The comments of a photo (sheet over the viewer): the list and a field to write at the bottom. */
export function CommentsScreen({ mediaId }: { mediaId: string }) {
  const insets = useSafeAreaInsets();
  const { me } = useMe();
  const { comments, error, loading, refetch, isRefetching } = useComments(mediaId);
  const add = useAddComment(mediaId);
  const remove = useDeleteComment(mediaId);
  const report = useReport();
  const [draft, setDraft] = useState("");
  // The root's padding carries the safe area at rest and the keyboard while typing, so the field always sits above it.
  const keyboardStyle = useKeyboardLift(Math.max(insets.bottom, spacing.sm), 0, spacing.sm);

  function send() {
    if (!canSend(draft) || add.isPending) return;
    add.mutate(cleanDraft(draft), { onSuccess: () => setDraft("") });
  }

  // The row that is open, so opening another one closes it.
  const openRow = useRef<SwipeableMethods | null>(null);
  const rows = useRef(new Map<string, SwipeableMethods>());

  // The menu is only for reporting someone else's comment; deleting is the swipe.
  function menuFor(comment: Comment): MenuAction[] {
    if (comment.author.userId === me?.id) return [];
    return [{ id: "report", title: "Denunciar", image: "exclamationmark.bubble" }];
  }

  function renderRow(item: Comment) {
    const menu = menuFor(item);
    const row = (
      <View
        testID={`comment-${item.id}`}
        style={[styles.row, styles.rowBackground]}
        accessibilityActions={item.canDelete ? [{ name: "delete", label: "Borrar" }] : undefined}
        onAccessibilityAction={item.canDelete ? () => remove.mutate(item.id) : undefined}
      >
        <Avatar id={item.author.userId} name={item.author.name} avatarUrl={item.author.avatarUrl} size={40} />
        <View style={styles.body}>
          <Text style={type.subhead}>
            <Text style={styles.name}>{item.author.name}</Text>
            <Text style={styles.ago}>{`  ${formatAgo(item.createdAt)}`}</Text>
          </Text>
          <Text style={[type.body, styles.text]} selectable>
            {item.text}
          </Text>
        </View>
        {menu.length > 0 && (
          <MenuView actions={menu} onPressAction={() => void report.reportComment(item.id)}>
            <View accessibilityRole="button" accessibilityLabel="Más opciones" style={styles.more}>
              <SymbolView name="ellipsis" size={16} tintColor={colors.secondaryLabel as string} />
            </View>
          </MenuView>
        )}
      </View>
    );
    if (!item.canDelete) return row;
    return (
      <ReanimatedSwipeable
        ref={(m) => {
          if (m) rows.current.set(item.id, m);
          else rows.current.delete(item.id);
        }}
        friction={2}
        overshootRight={false}
        rightThreshold={DELETE_WIDTH / 2}
        onSwipeableWillOpen={() => {
          const self = rows.current.get(item.id);
          if (openRow.current && openRow.current !== self) openRow.current.close();
          openRow.current = self ?? null;
        }}
        renderRightActions={() => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Borrar"
            onPress={() => remove.mutate(item.id)}
            style={styles.delete}
          >
            <SymbolView name="trash" size={20} tintColor="#FFFFFF" />
          </Pressable>
        )}
      >
        {row}
      </ReanimatedSwipeable>
    );
  }

  return (
    <Animated.View style={[styles.fill, keyboardStyle]}>
      {comments ? (
        <FlatList
          data={comments}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={[type.subhead, styles.empty]}>Todavía no hay comentarios. Escribí el primero.</Text>}
          renderItem={({ item }) => renderRow(item)}
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

      <View style={styles.composer}>
        {add.error && <ErrorText>{errorMessage(add.error, "No se pudo comentar")}</ErrorText>}
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="Escribí un comentario"
            placeholder="Escribí un comentario"
            placeholderTextColor={colors.tertiaryLabel}
            value={draft}
            onChangeText={setDraft}
            maxLength={COMMENT_MAX_LENGTH}
            multiline
            style={[type.body, styles.input]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            accessibilityState={{ disabled: !canSend(draft) || add.isPending, busy: add.isPending }}
            disabled={!canSend(draft) || add.isPending}
            onPress={send}
            style={({ pressed }) => [styles.send, (!canSend(draft) || add.isPending) && styles.sendOff, pressed && styles.pressed]}
          >
            {add.isPending ? <ActivityIndicator /> : <SymbolView name="arrow.up.circle.fill" size={32} tintColor={colors.tint as string} />}
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  list: { paddingVertical: spacing.md, flexGrow: 1 },
  center: { flex: 1, justifyContent: "center", gap: spacing.md, padding: spacing.lg },
  empty: { color: colors.secondaryLabel, textAlign: "center", marginTop: spacing.xl },
  row: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rowBackground: { backgroundColor: colors.background },
  delete: { width: DELETE_WIDTH, alignItems: "center", justifyContent: "center", backgroundColor: colors.danger },
  body: { flex: 1, gap: 2 },
  name: { fontWeight: "600", color: colors.label },
  ago: { color: colors.secondaryLabel },
  text: { color: colors.label },
  more: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  composer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    backgroundColor: colors.background,
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  input: {
    flex: 1,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.fill,
    color: colors.label,
  },
  send: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  sendOff: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
});
