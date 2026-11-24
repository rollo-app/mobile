import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "@/ui/theme";

/** The organizer's text, clamped to 3 lines with "Ver más" when it overflows. `onCover` is white text over the hero's dark fade. */
export function EventDescription({ text, onCover }: { text: string; onCover?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  // A new text starts collapsed and is measured again.
  useEffect(() => {
    setExpanded(false);
    setOverflows(false);
  }, [text]);
  const textStyle = [type.subhead, { color: onCover ? "rgba(255,255,255,0.85)" : colors.secondaryLabel }];
  return (
    <View testID="event-description" style={styles.box}>
      <Text
        numberOfLines={expanded ? undefined : 3}
        style={textStyle}
      >
        {text}
      </Text>
      {/* Hidden, unclamped copy: its line count decides `overflows` (the clamped Text may only report the visible lines). */}
      <Text
        testID="event-description-measure"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        onTextLayout={(e) => setOverflows(e.nativeEvent.lines.length > 3)}
        style={[textStyle, styles.measure]}
      >
        {text}
      </Text>
      {overflows && !expanded && (
        <Pressable accessibilityRole="button" accessibilityLabel="Ver más" hitSlop={8} onPress={() => setExpanded(true)}>
          <Text style={[type.subhead, styles.more, { color: onCover ? "#fff" : colors.tint }]}>Ver más</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.xs },
  measure: { position: "absolute", left: 0, right: 0, opacity: 0 },
  more: { fontWeight: "600" },
});
