import { SymbolView } from "expo-symbols";
import { ScrollView, StyleSheet, Text, Pressable, View } from "react-native";
import { Avatar } from "@/features/profile/avatar";
import { colors, spacing, type } from "@/ui/theme";
import type { Person } from "./people-order";

type Props = { people: Person[]; selectedId: string | null; onSelect: (id: string | null) => void };

const SIZE = 40;
const RING = 2;

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

function Item({ label, name, selected, onPress, children }: { label: string; name: string; selected: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={styles.item}>
      <View style={[styles.ring, selected && styles.ringSelected]}>{children}</View>
      <Text numberOfLines={1} style={styles.name}>
        {name}
      </Text>
    </Pressable>
  );
}

/** Horizontal row of faces to filter the revealed gallery by person; "Todos" clears the filter. */
export function PeopleRow({ people, selectedId, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Item label="Todos" name="Todos" selected={selectedId === null} onPress={() => onSelect(null)}>
        <View style={styles.all}>
          <SymbolView name="person.2.fill" size={20} tintColor={colors.label} />
        </View>
      </Item>
      {people.map((p) => (
        <Item key={p.id} label={p.name} name={firstName(p.name)} selected={selectedId === p.id} onPress={() => onSelect(selectedId === p.id ? null : p.id)}>
          <Avatar id={p.id} name={p.name} avatarUrl={p.avatarUrl} size={SIZE} />
        </Item>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  item: { alignItems: "center", width: SIZE + 16, gap: spacing.xs },
  ring: {
    padding: RING,
    borderRadius: (SIZE + RING * 2) / 2,
    borderWidth: RING,
    borderColor: "transparent",
  },
  ringSelected: { borderColor: colors.tint },
  all: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: colors.fill, alignItems: "center", justifyContent: "center" },
  name: { ...type.caption, color: colors.secondaryLabel },
});
