import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RollTitle } from "@/features/roll/roll-title";
import { colors, spacing, type } from "@/ui/theme";

/** What sits on the right of the summary: "Seleccionar" when idle, "Seleccionar todo" / "Deseleccionar todo" while selecting. */
export type HeadingAction =
  | { kind: "select"; onPress: () => void; disabled?: boolean }
  | { kind: "select-all"; allSelected: boolean; onPress: () => void; disabled?: boolean };

function actionLabel(action: HeadingAction) {
  if (action.kind === "select") return "Seleccionar";
  return action.allSelected ? "Deseleccionar todo" : "Seleccionar todo";
}

/**
 * Top of the gallery's list: the roll's name, then the summary on the left and, when there is something
 * to do, a plain text action on the right. It scrolls away with the content.
 */
export const GalleryHeading = memo(function GalleryHeading({
  name,
  summary,
  action,
}: {
  name?: string;
  summary: string | null;
  /** Not given when the gallery has nothing to select or isn't the view in front. */
  action?: HeadingAction;
}) {
  return (
    <View testID="gallery-heading" style={styles.root}>
      {!!name && <RollTitle name={name} />}
      <View style={styles.row}>
        <Text style={[type.subhead, styles.summary]}>{summary}</Text>
        {!!action && (
          <Pressable accessibilityRole="button" disabled={action.disabled} onPress={action.onPress} style={styles.action}>
            <Text style={[type.body, { color: colors.tint, opacity: action.disabled ? 0.4 : 1 }]}>{actionLabel(action)}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 44 },
  summary: { flex: 1, color: colors.secondaryLabel },
  action: { minHeight: 44, justifyContent: "center" },
});
