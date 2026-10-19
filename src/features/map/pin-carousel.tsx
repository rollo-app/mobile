import { FlatList, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { spacing } from "@/ui/theme";
import type { MapItem } from "./features";
import { PinCard } from "./pin-card";

const GAP = spacing.sm;
/** Cuánto de la tarjeta siguiente asoma, para que se note que se desliza. */
const PEEK = 28;

/**
 * Las fotos de un mismo lugar, de la más vieja a la más nueva, en tarjetas que se deslizan una a
 * una con un poco de la siguiente asomando. Con una sola foto es la tarjeta suelta.
 */
export function PinCarousel({
  items,
  index,
  onIndexChange,
  timeZone,
}: {
  items: MapItem[];
  index: number;
  onIndexChange: (index: number) => void;
  timeZone: string;
}) {
  const { width } = useWindowDimensions();

  if (items.length === 1) {
    return (
      <View style={styles.single}>
        <PinCard item={items[0]!} timeZone={timeZone} />
      </View>
    );
  }

  const cardWidth = width - 2 * spacing.md - PEEK;
  const step = cardWidth + GAP;

  function onEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.x / step)));
    if (next !== index) onIndexChange(next);
  }

  return (
    <FlatList
      testID="pin-carousel"
      horizontal
      data={items}
      keyExtractor={(i) => i.id}
      renderItem={({ item }) => (
        <View style={{ width: cardWidth }}>
          <PinCard item={item} timeZone={timeZone} />
        </View>
      )}
      initialScrollIndex={index}
      getItemLayout={(_, i) => ({ length: cardWidth, offset: step * i, index: i })}
      snapToInterval={step}
      decelerationRate="fast"
      disableIntervalMomentum
      showsHorizontalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
      contentContainerStyle={styles.content}
      onMomentumScrollEnd={onEnd}
    />
  );
}

const styles = StyleSheet.create({
  single: { paddingHorizontal: spacing.md },
  content: { paddingHorizontal: spacing.md },
});
