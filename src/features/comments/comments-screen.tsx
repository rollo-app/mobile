import { MenuView, type MenuAction } from "@expo/ui/community/menu";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorMessage } from "@/api/client";
import { useMe } from "@/features/auth/use-me";
import { useReport } from "@/features/moderation/use-report";
import { Avatar } from "@/features/profile/avatar";
import { Button, ErrorText } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import type { Comment } from "./actions";
import { canSend, cleanDraft, COMMENT_MAX_LENGTH } from "./draft";
import { formatAgo } from "./relative-time";
import { useAddComment } from "./use-add-comment";
import { useComments } from "./use-comments";
import { useDeleteComment } from "./use-delete-comment";

/** The comments of a photo (sheet over the viewer): the list and a field to write at the bottom. */
export function CommentsScreen({ mediaId }: { mediaId: string }) {
  const insets = useSafeAreaInsets();
  const { me } = useMe();
  const { comments, error, loading, refetch, isRefetching } = useComments(mediaId);
  const add = useAddComment(mediaId);
  const remove = useDeleteComment(mediaId);
  const report = useReport();
  const [draft, setDraft] = useState("");

  function send() {
    if (!canSend(draft) || add.isPending) return;
    add.mutate(cleanDraft(draft), { onSuccess: () => setDraft("") });
  }

  function menuFor(comment: Comment): MenuAction[] {
    const actions: MenuAction[] = [];
    if (comment.canDelete) actions.push({ id: "delete", title: "Borrar", image: "trash", attributes: { destructive: true } });
    if (comment.author.userId !== me?.id) actions.push({ id: "report", title: "Denunciar", image: "exclamationmark.bubble" });
    return actions;
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.fill}>
      {comments ? (
        <FlatList
          data={comments}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={[type.subhead, styles.empty]}>Todavía no hay comentarios. Escribí el primero.</Text>}
          renderItem={({ item }) => (
            <View testID={`comment-${item.id}`} style={styles.row}>
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
              {menuFor(item).length > 0 && (
                <MenuView
                  actions={menuFor(item)}
                  onPressAction={({ nativeEvent }) => {
                    if (nativeEvent.event === "delete") remove.mutate(item.id);
                    else void report.reportComment(item.id);
                  }}
                >
                  <View accessibilityRole="button" accessibilityLabel="Más opciones" style={styles.more}>
                    <SymbolView name="ellipsis" size={16} tintColor={colors.secondaryLabel as string} />
                  </View>
                </MenuView>
              )}
            </View>
          )}
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

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  center: { flex: 1, justifyContent: "center", gap: spacing.md, padding: spacing.lg },
  empty: { color: colors.secondaryLabel, textAlign: "center", marginTop: spacing.xl },
  row: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
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
