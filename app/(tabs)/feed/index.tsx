import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { usePendingItems } from "@/features/capture/use-pending-items";
import { FeedRow } from "@/features/feed/feed-row";
import { groupByDay, newest, type FeedSection } from "@/features/feed/sections";
import { feedToItems, mergeItems, pendingToItems, type MapItem } from "@/features/map/features";
import { NoRollYet } from "@/features/roll/no-roll-yet";
import { hasNoTrips } from "@/features/trips/active";
import { deleteMedia } from "@/features/trips/actions";
import { TabSwipe } from "@/features/navigation/tab-swipe";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { feedKey, useFeed } from "@/features/trips/use-feed";
import { tripKey, useTripDetail } from "@/features/trips/use-trip-detail";
import { ErrorText, Footnote } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";

// Avatar (36) + row margins: the hairline starts where the text starts, like in Messages.
const SEPARATOR_INSET = spacing.md + 36 + spacing.md;

const Separator = memo(function Separator() {
  return <View style={styles.separator} />;
});

const PAGE = 30;

const keyExtractor = (item: MapItem) => item.id;

export default function FeedScreen() {
  const { trip, loaded } = useActiveTrip();
  return <TabSwipe current="feed">{hasNoTrips(loaded, trip) ? <NoRollYet /> : <FeedList />}</TabSwipe>;
}

function FeedList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { trip } = useActiveTrip();
  const tripId = trip?.id;
  const { detail } = useTripDetail(tripId);
  const { feed, error, loading, refetch } = useFeed(tripId);
  const pending = usePendingItems(tripId);
  const [refreshing, setRefreshing] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const timeZone = detail?.trip.timezone ?? "America/Argentina/Buenos_Aires";
  const me = detail?.me;
  const isAdmin = me?.role === "admin";

  const all = useMemo(() => {
    const mine = me ? pendingToItems(pending, me) : [];
    return mergeItems(feed ? feedToItems(feed.items) : [], mine);
  }, [feed, pending, me]);

  // The server sends everything at once: show it in batches, newest first, and add more on reaching the end.
  const sections = useMemo(() => groupByDay(newest(all, limit), timeZone), [all, limit, timeZone]);
  const loadMore = useCallback(() => setLimit((n) => (n < all.length ? n + PAGE : n)), [all.length]);

  const openOnMap = useCallback(
    (item: MapItem) => router.navigate({ pathname: "/map", params: { focus: item.id } }),
    [router],
  );

  const remove = useCallback(
    async (item: MapItem) => {
      if (!tripId) return;
      try {
        await deleteMedia(item.id);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: feedKey(tripId) }),
          queryClient.invalidateQueries({ queryKey: tripKey(tripId) }),
        ]);
      } catch (e) {
        Alert.alert("No se pudo borrar", e instanceof Error ? e.message : "Probá de nuevo");
      }
    },
    [tripId, queryClient],
  );

  const confirmRemove = useCallback(
    (item: MapItem) =>
      Alert.alert("¿Borrar esta foto?", "No se puede deshacer.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Borrar", style: "destructive", onPress: () => void remove(item) },
      ]),
    [remove],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const renderItem = useCallback(
    ({ item }: { item: MapItem }) => (
      <FeedRow item={item} timeZone={timeZone} onPress={openOnMap} onDelete={isAdmin ? confirmRemove : undefined} />
    ),
    [timeZone, openOnMap, isAdmin, confirmRemove],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: FeedSection }) => (
      <View style={styles.header}>
        <Text style={[type.subhead, styles.headerText]}>{section.title}</Text>
      </View>
    ),
    [],
  );

  const empty = loading ? (
    <ActivityIndicator testID="feed-loading" style={styles.loading} />
  ) : error ? (
    <View style={styles.message}>
      <ErrorText>{error}</ErrorText>
      <Pressable accessibilityRole="button" accessibilityLabel="Reintentar" onPress={() => void refetch()}>
        <Text style={[type.headline, { color: colors.tint }]}>Reintentar</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.empty}>
      <Footnote>Todavía no hay fotos. Las que saque cada uno van a aparecer acá.</Footnote>
    </View>
  );

  return (
    <SectionList
      testID="feed-list"
      style={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      sections={sections}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={empty}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      initialNumToRender={12}
      windowSize={7}
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: colors.background },
  header: { backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs },
  headerText: { color: colors.secondaryLabel, fontWeight: "600" },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: SEPARATOR_INSET },
  loading: { marginTop: spacing.md },
  empty: { paddingTop: spacing.md },
  message: { padding: spacing.md, gap: spacing.md, alignItems: "flex-start" },
});
