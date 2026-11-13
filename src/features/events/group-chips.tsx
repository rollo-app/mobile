import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type } from "@/ui/theme";

type Group = { id: string; name: string };

/**
 * Pill toggles to choose the groups a photo goes to (multi-select), made for the dark caption screen.
 * With `allOption` (organizers) the first chip is "Todos los grupos": checking it chooses every group.
 */
export function GroupChips({
  groups,
  selected,
  onChange,
  allOption,
  disabled,
}: {
  groups: Group[];
  selected: string[];
  onChange: (ids: string[]) => void;
  allOption: boolean;
  disabled?: boolean;
}) {
  const allOn = groups.length > 0 && groups.every((g) => selected.includes(g.id));
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  return (
    <View style={styles.wrap}>
      {allOption && <Chip label="Todos los grupos" on={allOn} disabled={disabled} onPress={() => onChange(allOn ? [] : groups.map((g) => g.id))} />}
      {groups.map((g) => (
        <Chip key={g.id} label={g.name} on={selected.includes(g.id)} disabled={disabled} onPress={() => toggle(g.id)} />
      ))}
    </View>
  );
}

function Chip({ label, on, disabled, onPress }: { label: string; on: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}
    >
      <Text style={[type.subhead, { color: on ? colors.onTint : "#fff" }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    minHeight: 36,
    maxWidth: "100%",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  chipOn: { backgroundColor: colors.tint },
});
