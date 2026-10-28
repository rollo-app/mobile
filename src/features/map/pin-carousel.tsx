import { FlatList, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { spacing } from "@/ui/theme";
import type { MapItem } from "./features";
import { PinCard } from "./pin-card";

const GAP = spacing.sm;
/** How much of the next card peeks out, so it's clear it swipes. */
const PEEK = 28;
/** Height of a card (88 pt thumbnail + padding): the map leaves this much room below the cluster it centers. */
export const CAROUSEL_HEIGHT = 88 + 2 * spacing.md;

/**
 * The photos of one spot, oldest to newest, in cards that swipe one by
 * one with a bit of the next peeking out. With a single photo it's the lone card.
 */
export function PinCarousel({
  items,
  index,
  onIndexChange,
  timeZone,
  token,
  onOpen,
  canOpen,
  onOpenAuthor,
}: {
  items: MapItem[];
  index: number;
  onIndexChange: (index: number) => void;
  timeZone: string;
  token?: string | null;
  onOpen?: (item: MapItem) => void;
  /** Which cards open on tap; all of them when omitted. */
  canOpen?: (item: MapItem) => boolean;
  /** Tap on a card's author (their profile). */
  onOpenAuthor?: (item: MapItem) => void;
}) {
  const { width } = useWindowDimensions();
  const openFor = (item: MapItem) => (onOpen && (!canOpen || canOpen(item)) ? () => onOpen(item) : undefined);

  if (items.length === 1) {
    return (
      <View style={styles.single}>
        <PinCard
          item={items[0]!}
          timeZone={timeZone}
          token={token}
          onOpen={openFor(items[0]!)}
          onAuthorPress={onOpenAuthor && (() => onOpenAuthor(items[0]!))}
        />
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
          <PinCard
            item={item}
            timeZone={timeZone}
            token={token}
            onOpen={openFor(item)}
            onAuthorPress={onOpenAuthor && (() => onOpenAuthor(item))}
          />
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
