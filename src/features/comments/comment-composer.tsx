import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { errorMessage } from "@/api/client";
import { ErrorText } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { canSend, cleanDraft, COMMENT_MAX_LENGTH } from "./draft";
import { useAddComment } from "./use-add-comment";

/** The field and send button. It owns the draft, so typing re-renders only this and not the list above. */
export function CommentComposer({ mediaId }: { mediaId: string }) {
  const add = useAddComment(mediaId);
  const [draft, setDraft] = useState("");
  const disabled = !canSend(draft) || add.isPending;

  function send() {
    if (disabled) return;
    add.mutate(cleanDraft(draft), { onSuccess: () => setDraft("") });
  }

  return (
    <View style={styles.composer}>
      {!!add.error && <ErrorText>{errorMessage(add.error, "No se pudo comentar")}</ErrorText>}
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
          accessibilityState={{ disabled, busy: add.isPending }}
          disabled={disabled}
          onPress={send}
          style={({ pressed }) => [styles.send, disabled && styles.sendOff, pressed && styles.pressed]}
        >
          {add.isPending ? <ActivityIndicator /> : <SymbolView name="arrow.up.circle.fill" size={32} tintColor={colors.tint as string} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
