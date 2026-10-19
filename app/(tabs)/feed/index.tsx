import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { usePendingItems } from "@/features/capture/use-pending-items";
import { FeedRow } from "@/features/feed/feed-row";
import { groupByDay, type FeedSection } from "@/features/feed/sections";
import { feedToItems, mergeItems, pendingToItems, type MapItem } from "@/features/map/features";
import { deleteMedia } from "@/features/trips/actions";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { feedKey, useFeed } from "@/features/trips/use-feed";
import { tripKey, useTripDetail } from "@/features/trips/use-trip-detail";
import { ErrorText, Footnote } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";

// Avatar (36) + márgenes de la fila: el hairline arranca donde empieza el texto, como en Mensajes.
const SEPARATOR_INSET = spacing.md + 36 + spacing.md;

const Separator = memo(function Separator() {
  return <View style={styles.separator} />;
});

const keyExtractor = (item: MapItem) => item.id;

export default function FeedScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { trip } = useActiveTrip();
  const tripId = trip?.tripId;
  const { detail } = useTripDetail(tripId);
  const { feed, error, loading, refetch } = useFeed(tripId);
  const pending = usePendingItems(tripId);
  const [refreshing, setRefreshing] = useState(false);

  const timeZone = detail?.trip.timezone ?? "America/Argentina/Buenos_Aires";
  const me = detail?.me;
  const isAdmin = me?.role === "admin";

  const sections = useMemo(() => {
    const mine = me ? pendingToItems(pending, me) : [];
    return groupByDay(mergeItems(feed ? feedToItems(feed.items) : [], mine), timeZone);
  }, [feed, pending, me, timeZone]);

  const openOnMap = useCallback(
    (item: MapItem) => router.navigate({ pathname: "/mapa", params: { focus: item.id } }),
    [router],
  );

  const remove = useCallback(
    async (item: MapItem) => {
      if (!tripId) return;
      try {
        await deleteMedia(tripId, item.id);
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
        <Text style={[type.headline, { color: colors.label }]}>Reintentar</Text>
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
