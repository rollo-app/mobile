import { Pressable, StyleSheet, Text, View } from "react-native";
import { tintHex, radius, spacing, type } from "@/ui/theme";
import { statCounts, topLine } from "./format";
import type { StoryStats } from "./story";

/** The closing numbers, then "Ver la galería" (closes the modal) or "Ver de nuevo". */
export function Outro({
  stats,
  onGallery,
  onReplay,
}: {
  stats: StoryStats;
  onGallery: () => void;
  onReplay: () => void;
}) {
  const top = topLine(stats);
  return (
    <View style={styles.fill}>
      <View style={styles.body}>
        <Text accessibilityRole="header" style={styles.heading}>
          Así fue
        </Text>
        <View style={styles.grid}>
          {statCounts(stats).map((s) => (
            <View key={s.label} style={styles.stat} accessible accessibilityLabel={`${s.value} ${s.label}`}>
              <Text style={styles.value}>{s.value}</Text>
              <Text style={styles.label}>{s.label}</Text>
            </View>
          ))}
        </View>
        {top ? <Text style={styles.top}>{top}</Text> : null}
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver la galería"
          onPress={onGallery}
          style={({ pressed }) => [styles.button, { backgroundColor: tintHex.dark, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.buttonText}>Ver la galería</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver de nuevo"
          onPress={onReplay}
          style={({ pressed }) => [styles.button, { backgroundColor: "rgba(255,255,255,0.14)", opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.buttonText}>Ver de nuevo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000", paddingHorizontal: spacing.lg, paddingBottom: 48, justifyContent: "space-between" },
  body: { flex: 1, justifyContent: "center", gap: spacing.xl },
  heading: { ...type.largeTitle, color: "#fff" },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: spacing.lg, columnGap: spacing.xl },
  stat: { minWidth: "40%" },
  value: { ...type.largeTitle, fontSize: 48, lineHeight: 54, color: "#fff" },
  label: { ...type.body, color: "rgba(255,255,255,0.7)" },
  top: { ...type.quote, color: "#fff" },
  actions: { gap: spacing.sm },
  button: { minHeight: 50, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  buttonText: { ...type.headline, color: "#fff" },
});
