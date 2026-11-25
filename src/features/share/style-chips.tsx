import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "@/ui/theme";
import { STORY_STYLES, STYLE_LABEL, type StoryStyle } from "./story-style";

/** Oscuro | Claro as two neutral pills (selection is neutral here, not cobalt). */
export function StyleChips({ value, onChange }: { value: StoryStyle; onChange: (style: StoryStyle) => void }) {
  return (
    <View style={styles.row}>
      {STORY_STYLES.map((s) => (
        <Pressable
          key={s}
          accessibilityRole="button"
          accessibilityState={{ selected: s === value }}
          accessibilityLabel={STYLE_LABEL[s]}
          onPress={() => onChange(s)}
          style={({ pressed }) => [styles.chip, s === value && styles.selected, pressed && styles.pressed]}
        >
          <Text style={[type.footnote, styles.label, s === value && styles.selectedLabel]}>{STYLE_LABEL[s]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.fill },
  selected: { backgroundColor: colors.separator },
  pressed: { opacity: 0.6 },
  label: { color: colors.secondaryLabel },
  selectedLabel: { color: colors.label, fontWeight: "600" },
});
