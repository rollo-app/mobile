import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { dateFormatter } from "@/lib/intl";
import { colors, spacing, type } from "@/ui/theme";
import { Cell, sameCell, type CellProps } from "./gallery-cell";

type Props = CellProps & { timeZone: string; side: "left" | "right" };

const GAP = 2;

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** A captioned photo's own row: the photo as a regular cell on one side (`side`; the other quotes mirror it), its caption in the serif beside it. The text acts like the cell (opens the photo, or toggles it while selecting). */
export const QuoteRow = memo(function QuoteRow({ timeZone, side, ...cell }: Props) {
  const { photo, size, selecting, selected, onPress } = cell;
  const time = dateFormatter("es-AR", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(photo.takenAt);
  return (
    <View style={[styles.row, side === "right" && styles.mirrored]}>
      <Cell {...cell} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Cita: ${photo.caption}, de ${photo.author.name}, ${time}`}
        accessibilityState={selecting ? { selected } : undefined}
        onPress={() => onPress(photo)}
        style={[styles.text, { minHeight: size }]}
      >
        <Text numberOfLines={4} style={[type.quote, styles.caption, selected && styles.selected]}>{photo.caption}</Text>
        <Text numberOfLines={1} style={[type.caption, styles.by]}>{`${firstName(photo.author.name)} · ${time}`}</Text>
      </Pressable>
    </View>
  );
}, (a, b) => sameCell(a, b) && a.photo.caption === b.photo.caption && a.photo.takenAt === b.photo.takenAt && a.timeZone === b.timeZone && a.side === b.side);

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingBottom: GAP },
  // row-reverse keeps the photo first for VoiceOver while drawing it on the right.
  mirrored: { flexDirection: "row-reverse" },
  text: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.lg, gap: spacing.xs },
  caption: { fontStyle: "italic", color: colors.label },
  selected: { color: colors.tint },
  by: { color: colors.secondaryLabel },
});
