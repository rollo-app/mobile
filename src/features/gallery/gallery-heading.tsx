import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RollTitle } from "@/features/roll/roll-title";
import { colors, spacing, type } from "@/ui/theme";

/**
 * Top of the gallery's list: the roll's name, then the summary on the left and, when there is something
 * to select, "Seleccionar" on the right. It scrolls away with the content.
 */
export const GalleryHeading = memo(function GalleryHeading({
  name,
  summary,
  onSelect,
  selectDisabled,
}: {
  name?: string;
  summary: string | null;
  /** Starts selecting; not given when the gallery has nothing to select or isn't the view in front. */
  onSelect?: () => void;
  selectDisabled?: boolean;
}) {
  return (
    <View style={styles.root}>
      {!!name && <RollTitle name={name} />}
      <View style={styles.row}>
        <Text style={[type.subhead, styles.summary]}>{summary}</Text>
        {!!onSelect && (
          <Pressable accessibilityRole="button" disabled={selectDisabled} onPress={onSelect} style={styles.action}>
            <Text style={[type.body, { color: colors.tint, opacity: selectDisabled ? 0.4 : 1 }]}>Seleccionar</Text>
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
