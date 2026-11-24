import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "@/ui/theme";
import type { Chapter } from "./chapters";
import { useChapterPlace } from "./use-chapter-place";

/** "47 fotos · El Bolsón"; the place is left out while it is unknown. */
export function chapterLine(count: number, place: string | null) {
  const photos = `${count} ${count === 1 ? "foto" : "fotos"}`;
  return place ? `${photos} · ${place}` : photos;
}

/** The start of a chapter: kicker, serif title and "N fotos · place". */
export const ChapterHeader = memo(function ChapterHeader({ chapter }: { chapter: Chapter }) {
  const place = useChapterPlace(chapter.photos, chapter.placeable);
  return (
    <View style={styles.wrap}>
      {!!chapter.kicker && <Text style={[type.caption, styles.kicker]}>{chapter.kicker}</Text>}
      <Text accessibilityRole="header" style={styles.title}>
        {chapter.title}
      </Text>
      <Text style={[type.subhead, styles.line]}>{chapterLine(chapter.photos.length, place)}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm, gap: 2 },
  kicker: { color: colors.secondaryLabel, textTransform: "uppercase", letterSpacing: 0.5 },
  title: { fontSize: type.title.fontSize, fontWeight: "700", fontFamily: type.quote.fontFamily, color: colors.label },
  line: { color: colors.secondaryLabel },
});
