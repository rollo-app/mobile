import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "@/ui/theme";

export type ShareMode = "collage" | "journey";
const MODES: { value: ShareMode; label: string }[] = [
  { value: "collage", label: "Collage" },
  { value: "journey", label: "Recorrido" },
];

/** Collage | Recorrido, in the same neutral pill style as the style chips. */
export function ModeChips({ value, onChange }: { value: ShareMode; onChange: (mode: ShareMode) => void }) {
  return (
    <View style={styles.row}>
      {MODES.map((m) => (
        <Pressable
          key={m.value}
          accessibilityRole="button"
          accessibilityState={{ selected: m.value === value }}
          accessibilityLabel={m.label}
          onPress={() => onChange(m.value)}
          style={({ pressed }) => [styles.chip, m.value === value && styles.selected, pressed && styles.pressed]}
        >
          <Text style={[type.footnote, styles.label, m.value === value && styles.selectedLabel]}>{m.label}</Text>
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
