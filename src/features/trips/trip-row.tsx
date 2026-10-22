import { SymbolView } from "expo-symbols";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { Badge } from "@/ui/badge";
import { colors, spacing, type } from "@/ui/theme";
import type { TripSummary } from "./active";
import { tripRowState } from "./row-state";
import { rowTint } from "./row-tint";
import { thumbHashAverageColor, type RGB } from "./thumbhash-color";

const BADGE_LABEL = { live: "EN VIVO", revealed: "Revelado" } as const;

/** A row of "Tus rollos": tinted with the roll's color, with its state as badge or subtitle. */
export function TripRow({
  trip,
  selected,
  now,
  timeZone,
  onPress,
}: {
  trip: TripSummary;
  selected: boolean;
  now: number;
  timeZone: string;
  onPress: () => void;
}) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const state = tripRowState(trip, now, timeZone);
  const average = useMemo(() => (trip.coverThumbhash ? thumbHashAverageColor(trip.coverThumbhash) : null), [trip.coverThumbhash]);
  const tint = average ? rowTint(average, scheme) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={state.stateLabel ? `${trip.name}, ${state.stateLabel}` : trip.name}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.fill }]}
    >
      {tint && <Gradient color={tint} />}
      <View style={styles.text}>
        <Text style={[type.body, { color: colors.label }]} numberOfLines={1}>
          {trip.name}
        </Text>
        <Text style={[type.footnote, { color: colors.secondaryLabel }]} numberOfLines={1}>
          {state.subtitle}
        </Text>
      </View>
      {(state.badge || selected) && (
        <View testID="trip-row-trailing" style={styles.trailing}>
          {state.badge && <Badge variant={state.badge === "live" ? "live" : "neutral"} label={BADGE_LABEL[state.badge]} />}
          {selected && <SymbolView name="checkmark" size={16} weight="semibold" tintColor={colors.tint as string} />}
        </View>
      )}
    </Pressable>
  );
}

const STRIPS = 24;

/**
 * Left-to-right fade from `color` to transparent over 85% of the row, without a native gradient:
 * thin strips with decreasing opacity (24 steps are too fine to see as bands).
 */
function Gradient({ color }: { color: RGB }) {
  const { r, g, b } = color;
  return (
    <View pointerEvents="none" style={styles.gradient}>
      {Array.from({ length: STRIPS }, (_, i) => {
        const alpha = (1 - (i + 0.5) / STRIPS) ** 1.3;
        return <View key={i} style={[styles.strip, { backgroundColor: `rgba(${r},${g},${b},${alpha.toFixed(3)})` }]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 11, gap: spacing.sm },
  gradient: { position: "absolute", top: 0, bottom: 0, left: 0, right: "15%", flexDirection: "row" },
  strip: { flex: 1 },
  text: { flex: 1, gap: 2 },
  trailing: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
