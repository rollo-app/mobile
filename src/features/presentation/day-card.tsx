import { StyleSheet, Text, View } from "react-native";
import { spacing, type } from "@/ui/theme";
import { formatCount } from "./format";
import type { StoryStep } from "./story";

/** The cut between days: "Día 3" and its date; a trimmed day also says how many it had and that this is a selection. */
export function DayCard({ step }: { step: Extract<StoryStep, { kind: "day" }> }) {
  const total = `${formatCount(step.count)} fotos`;
  const selection = `Una selección de ${formatCount(step.shown)}`;
  const label = `${step.title}, ${step.date}` + (step.trimmed ? `, ${total}, ${selection.toLowerCase()}` : "");
  return (
    <View style={styles.fill} accessible accessibilityRole="header" accessibilityLabel={label}>
      <Text style={styles.title}>{step.title}</Text>
      <Text style={styles.date}>{step.date}</Text>
      {step.trimmed ? (
        <View style={styles.selection}>
          <Text style={styles.date}>{total}</Text>
          <Text style={styles.note}>{selection}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  title: { ...type.largeTitle, color: "#fff" },
  date: { ...type.body, color: "rgba(255,255,255,0.7)" },
  selection: { alignItems: "center", marginTop: spacing.md },
  note: { ...type.footnote, color: "rgba(255,255,255,0.5)" },
});
