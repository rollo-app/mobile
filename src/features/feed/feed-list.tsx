import { useRouter } from "expo-router";
import { errorMessage } from "@/api/client";
import { memo, useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { usePendingItems } from "@/features/capture/use-pending-items";
import { FeedRow } from "@/features/feed/feed-row";
import { groupByDay, type FeedSection } from "@/features/feed/sections";
import { useReport } from "@/features/moderation/use-report";
import { useMediaToken } from "@/features/media/revealed";
import { feedToItems, mergeItems, pendingToItems, type MapItem } from "@/features/map/features";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { useRemoveFeedPhoto } from "./use-remove-feed-photo";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useFeed } from "@/features/trips/use-feed";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { ErrorText, Footnote } from "@/ui/components";
import { LoadMoreFooter } from "@/ui/load-more-footer";
import { colors, spacing, type } from "@/ui/theme";

// Avatar (36) + row margins: the hairline starts where the text starts, like in Messages.
const SEPARATOR_INSET = spacing.md + 36 + spacing.md;

const Separator = memo(function Separator() {
  return <View style={styles.separator} />;
});

const keyExtractor = (item: MapItem) => item.id;

type FeedListProps = {
  /** Where tapping a row goes: the map, focused on that pin. */
  onOpenOnMap: (item: MapItem) => void;
  /** Extra padding above the list (for content drawn over it). */
  contentInsetTop?: number;
};

export function FeedList({ onOpenOnMap, contentInsetTop }: FeedListProps) {
  const { trip } = useActiveTrip();
  const tripId = trip?.id;
  const { detail } = useTripDetail(tripId);
  const { feed, error, loading, refetch, hasMore, fetchMore, loadingMore, loadMoreError } = useFeed(tripId, { mode: "lazy", order: "desc" });
  const pending = usePendingItems(tripId);
  const token = useMediaToken(tripId);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const timeZone = detail?.trip.timezone ?? "America/Argentina/Buenos_Aires";
  const me = detail?.me;
  const isAdmin = me?.role === "admin";

  const all = useMemo(() => {
    const mine = me ? pendingToItems(pending, me) : [];
    return mergeItems(feed ? feedToItems(feed.items) : [], mine);
  }, [feed, pending, me]);

  // The server sends pages newest first and groupByDay sorts: a page appended at the end only adds older rows (or more of the last day).
  const sections = useMemo(() => groupByDay(all, timeZone), [all, timeZone]);
  const loadMore = useCallback(() => {
    if (hasMore && !loadingMore && !loadMoreError) void fetchMore();
  }, [hasMore, loadingMore, loadMoreError, fetchMore]);

  const { mutate: removePhoto } = useRemoveFeedPhoto();
  const remove = useCallback(
    (item: MapItem) => {
      if (!tripId) return;
      removePhoto(
        { mediaId: item.id, tripId },
        { onError: (e) => Alert.alert("No se pudo borrar", errorMessage(e, "Probá de nuevo") ?? undefined) },
      );
    },
    [tripId, removePhoto],
  );

  const confirmRemove = useCallback(
    (item: MapItem) =>
      Alert.alert("¿Borrar esta foto?", "No se puede deshacer.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Borrar", style: "destructive", onPress: () => remove(item) },
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

  const report = useReport();
  const reportItem = useCallback((item: MapItem) => void report.reportMedia({ mediaId: item.id, tripId }), [report.reportMedia, tripId]);

  const openProfile = useOpenProfile();
  const openAuthor = useCallback((item: MapItem) => item.authorUserId && openProfile(item.authorUserId), [openProfile]);

  const openPhoto = useCallback(
    (item: MapItem) => tripId && router.push({ pathname: "/photo/[id]", params: { id: item.id, tripId } }),
    [router, tripId],
  );

  const renderItem = useCallback(
    ({ item }: { item: MapItem }) => (
      <FeedRow
        item={item}
        timeZone={timeZone}
        onPress={onOpenOnMap}
        token={token}
        onOpenPhoto={openPhoto}
        onAuthorPress={openAuthor}
        onDelete={isAdmin ? confirmRemove : undefined}
        onReport={me && item.authorUserId !== me.userId ? reportItem : undefined}
      />
    ),
    [timeZone, onOpenOnMap, token, openPhoto, openAuthor, isAdmin, confirmRemove, me, reportItem],
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
  ) : hasMore ? undefined : (
    <View style={styles.empty}>
      <Footnote>Todavía no hay fotos. Las que saque cada uno van a aparecer acá.</Footnote>
    </View>
  );

  return (
    <SectionList
      testID="feed-list"
      style={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={contentInsetTop ? { paddingTop: contentInsetTop } : undefined}
      sections={sections}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={empty}
      ListFooterComponent={<LoadMoreFooter loading={loadingMore} error={loadMoreError} onRetry={() => void fetchMore()} testID="feed-loading-more" />}
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
