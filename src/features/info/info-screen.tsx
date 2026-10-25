import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "@/ui/theme";
import { infoTopic, splitButtonNames } from "./topics";

/**
 * The body of the info sheet: the topic's title and its short paragraphs. Button names (quoted in the catalog) show
 * bold in the app's tint, without the quotes. An unknown topic shows nothing.
 */
export function InfoScreen({ topic }: { topic: string | string[] | undefined }) {
  const found = infoTopic(topic);
  if (!found) return null;
  return (
    <View style={styles.sheet}>
      <Text accessibilityRole="header" style={[type.title, { color: colors.label }]}>
        {found.title}
      </Text>
      {found.body.split("\n\n").map((paragraph) => (
        <Text key={paragraph} style={[type.body, { color: colors.label }]}>
          {splitButtonNames(paragraph).map((part, i) =>
            part.button ? (
              <Text key={i} style={styles.button}>
                {part.text}
              </Text>
            ) : (
              part.text
            ),
          )}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.md, backgroundColor: colors.groupedBackground },
  button: { fontWeight: "600", color: colors.tint },
});
