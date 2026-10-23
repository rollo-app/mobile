import { StyleSheet, Text, View } from "react-native";
import { spacing, type } from "@/ui/theme";
import type { StoryStep } from "./story";

/** The cut between days: "Día 3" and its date. */
export function DayCard({ step }: { step: Extract<StoryStep, { kind: "day" }> }) {
  return (
    <View style={styles.fill} accessible accessibilityRole="header" accessibilityLabel={`${step.title}, ${step.date}`}>
      <Text style={styles.title}>{step.title}</Text>
      <Text style={styles.date}>{step.date}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  title: { ...type.largeTitle, color: "#fff" },
  date: { ...type.body, color: "rgba(255,255,255,0.7)" },
});
