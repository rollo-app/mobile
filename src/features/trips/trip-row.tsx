import { Image } from "expo-image";
import { useMemo } from "react";
import { FullWidthMenuView } from "@/ui/full-width-menu";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { Badge } from "@/ui/badge";
import { colors, radius, spacing, type } from "@/ui/theme";
import type { TripSummary } from "./active";
import { tripRowState } from "./row-state";
import { ROW_ACTION_TITLES, type RowActionId } from "./row-actions";
import { coverUri } from "./cover-uri";
import { rowTint } from "./row-tint";
import { thumbHashAverageColor, type RGB } from "./thumbhash-color";

const BADGE_LABEL = { live: "LIVE", revealed: "Revelado" } as const;

/** A row of the Rollos list: tinted with the roll's color, with its state as badge or subtitle. */
export function TripRow({
  trip,
  now,
  timeZone,
  onPress,
  actions = [],
  onAction,
}: {
  trip: TripSummary;
  now: number;
  timeZone: string;
  onPress: () => void;
  /** Long-press menu (and VoiceOver actions). */
  actions?: RowActionId[];
  onAction?: (id: RowActionId) => void;
}) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const state = tripRowState(trip, now, timeZone);
  const average = useMemo(() => (trip.coverThumbhash ? thumbHashAverageColor(trip.coverThumbhash) : null), [trip.coverThumbhash]);
  const tint = average ? rowTint(average, scheme) : null;
  const isEvent = trip.type === "event";
  const a11yName = isEvent ? `${trip.name}, evento` : trip.name;

  const row = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={state.stateLabel ? `${a11yName}, ${state.stateLabel}` : a11yName}
      accessibilityActions={actions.map((id) => ({ name: id, label: ROW_ACTION_TITLES[id] }))}
      onAccessibilityAction={({ nativeEvent }) => onAction?.(nativeEvent.actionName as RowActionId)}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.fill }]}
    >
      {tint && <Gradient color={tint} />}
      <Thumbnail trip={trip} />
      <View style={styles.text}>
        <Text style={[type.body, { color: colors.label }]} numberOfLines={1}>
          {trip.name}
        </Text>
        <Text style={[type.footnote, { color: colors.secondaryLabel }]} numberOfLines={1}>
          {state.subtitle}
        </Text>
      </View>
      {(isEvent || state.badge) && (
        <View testID="trip-row-trailing" style={styles.trailing}>
          {isEvent && <Badge variant="neutral" label="Evento" />}
          {state.badge && <Badge variant={state.badge === "live" ? "live" : "neutral"} label={BADGE_LABEL[state.badge]} />}
        </View>
      )}
    </Pressable>
  );
  if (actions.length === 0) return row;
  return (
    <FullWidthMenuView
      shouldOpenOnLongPress
      actions={actions.map((id) => ({
        id,
        title: ROW_ACTION_TITLES[id],
        image: id === "leave" ? "trash" : id === "archive" ? "archivebox" : "tray.and.arrow.up",
        ...(id === "leave" && { attributes: { destructive: true } }),
      }))}
      onPressAction={({ nativeEvent }) => onAction?.(nativeEvent.event as RowActionId)}
    >
      {row}
    </FullWidthMenuView>
  );
}

/** 40 pt rounded thumbnail: the event cover, else the blurred last photo (ThumbHash), else a neutral square. */
function Thumbnail({ trip }: { trip: TripSummary }) {
  const placeholder = trip.coverThumbhash ? { thumbhash: trip.coverThumbhash } : undefined;
  const uri = coverUri(trip.coverUrl);
  if (!uri && !placeholder) return <View testID="trip-row-thumb" style={[styles.thumb, { backgroundColor: colors.fill }]} />;
  return (
    <Image
      testID="trip-row-thumb"
      source={uri ? { uri } : undefined}
      placeholder={placeholder}
      contentFit="cover"
      style={styles.thumb}
      accessibilityIgnoresInvertColors
    />
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
  thumb: { width: 40, height: 40, borderRadius: radius.sm, borderCurve: "continuous", overflow: "hidden" },
  text: { flex: 1, gap: 2 },
  trailing: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
