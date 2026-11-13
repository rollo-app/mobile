import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Section } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";

type Group = { id: string; name: string };

/** The event's groups as a grouped list with a check on each chosen one (multi-select). */
export function PickGroups({ groups, selected, onChange }: { groups: Group[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  return (
    <Section>
      {groups.map((group) => {
        const on = selected.includes(group.id);
        return (
          <Pressable
            key={group.id}
            accessibilityRole="button"
            accessibilityLabel={group.name}
            accessibilityState={{ selected: on }}
            onPress={() => toggle(group.id)}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.fill }]}
          >
            <Text style={[type.body, styles.name]}>{group.name}</Text>
            <View style={styles.check}>{on && <SymbolView name="checkmark" size={16} weight="semibold" tintColor={colors.tint as string} />}</View>
          </Pressable>
        );
      })}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  name: { flex: 1, color: colors.label },
  check: { width: 20, alignItems: "center" },
});
