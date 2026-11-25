import { memo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import type { RevealedPhoto } from "@/features/media/revealed";
import { dateFormatter } from "@/lib/intl";
import { colors, spacing, type } from "@/ui/theme";

type Props = {
  photo: RevealedPhoto;
  timeZone: string;
  selecting: boolean;
  selected: boolean;
  onPress: (photo: RevealedPhoto) => void;
};

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** A photo's caption set in the serif between rows of the diary; it acts like the photo's cell (opens it, or toggles it while selecting). */
export const QuoteRow = memo(function QuoteRow({ photo, timeZone, selecting, selected, onPress }: Props) {
  const time = dateFormatter("es-AR", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(photo.takenAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Cita: ${photo.caption}, de ${photo.author.name}, ${time}`}
      accessibilityState={selecting ? { selected } : undefined}
      onPress={() => onPress(photo)}
      style={styles.row}
    >
      <Text style={[type.quote, styles.caption, selected && styles.selected]}>{photo.caption}</Text>
      <Text style={[type.caption, styles.by]}>{`${firstName(photo.author.name)} · ${time}`}</Text>
    </Pressable>
  );
}, (a, b) =>
  a.photo.id === b.photo.id &&
  a.photo.caption === b.photo.caption &&
  a.photo.takenAt === b.photo.takenAt &&
  a.photo.author.name === b.photo.author.name &&
  a.timeZone === b.timeZone &&
  a.selecting === b.selecting &&
  a.selected === b.selected &&
  a.onPress === b.onPress,
);

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: spacing.xs },
  caption: { fontStyle: "italic", color: colors.label },
  selected: { color: colors.tint },
  by: { color: colors.secondaryLabel },
});
