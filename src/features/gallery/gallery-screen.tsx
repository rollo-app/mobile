import { OriginalsNotice } from "@/features/trips/originals-notice-text";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMe } from "@/features/auth/use-me";
import { localDay } from "@/features/capture/quota";
import { isEvent, sendableGroups } from "@/features/events/event";
import { useToggleFeatured } from "@/features/featured/use-toggle-featured";
import { useRevealedPhotos, type RevealedPhoto } from "@/features/media/revealed";
import { rollSummary } from "@/features/roll/summary";
import { memberTotal } from "@/features/trips/member-total";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText } from "@/ui/components";
import { LoadMoreFooter } from "@/ui/load-more-footer";
import { colors, spacing, type } from "@/ui/theme";
import { buildChapters, type ChapterContext } from "./chapters";
import { ChapterHeader } from "./chapter-header";
import { Cell } from "./gallery-cell";
import { GalleryToolbar } from "./gallery-toolbar";
import { authorsOf, filterByAuthor, filterByGroup } from "./group";
import { diaryItems, type GridItem } from "./grid-items";
import { HeroCell } from "./hero-cell";
import { peopleOrder } from "./people-order";
import { PeopleRow } from "./people-row";
import { QuoteRow } from "./quote-row";
import { SaveBar } from "./save-bar";
import { useArchivePhoto } from "./use-archive-photo";
import { useBulkSave } from "./use-bulk-save";
import { useDeletePhoto } from "./use-delete-photo";
import { useGallerySelection } from "./use-gallery-selection";
import { useSaver } from "./use-saver";

const COLUMNS = 3;
const GAP = 2;

const keyExtractor = (item: GridItem) => item.key;
const getItemType = (item: GridItem) => item.kind;
// Chapter headers, heroes and quotes take the whole row.
const overrideItemLayout = (layout: { span?: number }, item: GridItem) => {
  if (item.kind !== "photo") layout.span = COLUMNS;
};
const DEVICE_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Revealed roll as a diary (chapters with a hero, quotes and a row of faces to filter by person), and downloads to Photos. `toolbar` false hides
 * its header buttons while it stays mounted behind another view.
 */
const ENDING_THRESHOLD = 1.5;

export function GalleryScreen({
  tripId,
  toolbar: showToolbar = true,
  onSelectionChange,
  header,
}: {
  tripId: string;
  toolbar?: boolean;
  /** Shown at the very top of the grid (the contest card). */
  header?: ReactNode;
  /** How many photos are selected while selecting, null otherwise: the screen that owns the header shows it as the title. */
  onSelectionChange?: (count: number | null) => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { photos, token, error, loading, refetch, loadAll, hasMore, loadingMore, loadMoreError, complete, fetchMore } =
    useRevealedPhotos(tripId, "lazy");
  const { detail } = useTripDetail(tripId);
  const saver = useSaver(token, detail?.trip.name, detail?.trip.timezone);
  const { toggle: toggleFeatured, error: featureError } = useToggleFeatured();
  const { me } = useMe();
  const revealed = detail?.trip.revealed === true;
  const setArchived = useArchivePhoto();
  const { confirmDelete } = useDeletePhoto();
  const [featureErrorDismissed, setFeatureErrorDismissed] = useState(false);
  useEffect(() => setFeatureErrorDismissed(false), [featureError]);

  const [authorId, setAuthorId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  // Only someone who sees more than one group (an organizer, or a guest in several) gets the group filter.
  const sendable = useMemo(() => (detail ? sendableGroups(detail) : []), [detail]);
  const groups = sendable.length > 1 ? sendable : [];

  const size = Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS);
  // Until every page is in, a member's photos may all be on a page not loaded yet: offer every member so they can still be picked.
  const members = detail?.members;
  const authors = useMemo(() => {
    const loaded = authorsOf(photos);
    if (complete || !members) return loaded;
    const known = new Set(loaded.map((a) => a.id));
    return [...loaded, ...members.filter((m) => !known.has(m.id)).map((m) => ({ id: m.id, name: m.name }))];
  }, [photos, members, complete]);
  const shown = useMemo(() => filterByGroup(filterByAuthor(photos, authorId), groupId), [photos, authorId, groupId]);
  const timeZone = detail?.trip.timezone ?? DEVICE_ZONE;
  const groupsKey = groupId;
  const chapterContext = useMemo<ChapterContext>(() => {
    if (!detail) return { kind: "trip", startDay: photos[0]?.day ?? "" };
    const { trip } = detail;
    if (!isEvent(trip)) return { kind: "trip", startDay: localDay(trip.startsAt, trip.timezone) };
    return {
      kind: "event",
      groups: groupsKey ? sendable.filter((g) => g.id === groupsKey) : sendable,
      showGroupTitle: sendable.length > 1,
      timeZone: trip.timezone,
      multiDay: localDay(trip.startsAt, trip.timezone) !== localDay(trip.endsAt, trip.timezone),
    };
  }, [detail, sendable, groupsKey, photos]);
  const chapters = useMemo(() => buildChapters(shown, chapterContext), [shown, chapterContext]);
  const items = useMemo(() => diaryItems(chapters, COLUMNS), [chapters]);
  const people = useMemo(() => (detail && me ? peopleOrder(detail.members, me.id, authors) : []), [detail, me, authors]);
  // Until every page is in, the photo count is the server's total, so the line doesn't grow while loading.
  const summary = useMemo(
    () =>
      detail
        ? rollSummary({
            media: photos,
            mediaCount: complete ? undefined : detail.totalUploaded,
            people: memberTotal(detail),
            startsAt: detail.trip.startsAt,
            endsAt: detail.trip.endsAt,
            timeZone: detail.trip.timezone,
          })
        : null,
    [detail, photos, complete],
  );
  const author = authors.find((a) => a.id === authorId);
  const group = groups.find((g) => g.id === groupId);

  const { selecting, selected, allSelected, toggle, toggleAll, start: startSelecting, stop: stopSelecting } =
    useGallerySelection(shown);
  // The grid loads on scroll, but whatever works on "everyone's photos" needs them all: selecting, filtering by person, and a first page with no photos in it.
  const needsAll = selecting || authorId !== null || groupId !== null || (!loading && photos.length === 0);
  useEffect(() => {
    if (needsAll && hasMore && !loadingMore && !loadMoreError) void fetchMore();
  }, [needsAll, hasMore, loadingMore, loadMoreError, fetchMore, photos]);
  const onEndReached = useCallback(() => {
    if (hasMore && !loadingMore && !loadMoreError) void fetchMore();
  }, [hasMore, loadingMore, loadMoreError, fetchMore]);

  const selectedCount = selecting ? selected.size : null;
  useEffect(() => onSelectionChange?.(selectedCount), [onSelectionChange, selectedCount]);
  useEffect(() => () => onSelectionChange?.(null), [onSelectionChange]);
  const { bar, busy, canSaveAll, run, confirmSaveAll, cancel, dismiss } = useBulkSave({
    saver,
    tripName: detail?.trip.name,
    photos,
    loadAll,
    onSaved: stopSelecting,
  });

  const onCellPress = useCallback(
    (photo: RevealedPhoto) => {
      if (selecting) toggle(photo.id);
      else {
        router.push({
          pathname: "/photo/[id]",
          params: { id: photo.id, tripId },
        });
      }
    },
    [selecting, toggle, router, tripId],
  );

  const onToggleFeatured = useCallback(
    (photo: RevealedPhoto) => void toggleFeatured(photo, tripId),
    [toggleFeatured, tripId],
  );

  const onOwnAction = useCallback(
    (photo: RevealedPhoto, action: "archive" | "unarchive" | "delete") => {
      if (action === "delete") void confirmDelete(photo, tripId);
      else setArchived(photo, tripId, action === "archive");
    },
    [confirmDelete, setArchived, tripId],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<GridItem>) => {
      if (item.kind === "chapter") return <ChapterHeader chapter={item.chapter} />;
      const { photo } = item;
      const own = revealed && !!me && photo.authorUserId === me.id;
      if (item.kind === "quote")
        return <QuoteRow photo={photo} timeZone={timeZone} selecting={selecting} selected={selected.has(photo.id)} onPress={onCellPress} />;
      if (item.kind === "hero")
        return (
          <View style={styles.hero}>
            <HeroCell
              photo={photo}
              token={token}
              size={width}
              selecting={selecting}
              selected={selected.has(photo.id)}
              own={own}
              onPress={onCellPress}
              onToggleFeatured={onToggleFeatured}
              onOwnAction={onOwnAction}
            />
          </View>
        );
      const { column } = item;
      return (
        <View style={[styles.slot, column === 0 ? styles.slotStart : column === COLUMNS - 1 ? styles.slotEnd : null]}>
          <Cell
            photo={photo}
            token={token}
            size={size}
            selecting={selecting}
            selected={selected.has(photo.id)}
            own={own}
            onPress={onCellPress}
            onToggleFeatured={onToggleFeatured}
            onOwnAction={onOwnAction}
          />
        </View>
      );
    },
    [token, size, width, timeZone, selecting, selected, revealed, me, onCellPress, onToggleFeatured, onOwnAction],
  );
  const listExtra = useMemo(() => ({ selecting, selected, token, revealed, meId: me?.id }), [selecting, selected, token, revealed, me?.id]);

  let body;
  if (loading) body = <>{header}<ActivityIndicator style={{ marginTop: spacing.xl }} /></>;
  else if (error && photos.length === 0)
    body = (
      <>
        {header}
        <View style={styles.center}>
          <ErrorText>{error}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} />
        </View>
      </>
    );
  else if (photos.length === 0 && (hasMore || loadingMore) && !loadMoreError)
    body = <>{header}<ActivityIndicator style={{ marginTop: spacing.xl }} /></>;
  else if (photos.length === 0)
    body = (
      <>
        {header}
        <View style={styles.center}>
          <Text style={[type.body, { color: colors.secondaryLabel }]}>Este rollo no tiene fotos</Text>
        </View>
      </>
    );
  else
    body = (
      <FlashList
        testID="gallery-list"
        data={items}
        numColumns={COLUMNS}
        getItemType={getItemType}
        overrideItemLayout={overrideItemLayout}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        extraData={listExtra}
        onEndReached={onEndReached}
        onEndReachedThreshold={ENDING_THRESHOLD}
        ListFooterComponent={
          <LoadMoreFooter loading={loadingMore} error={loadMoreError} onRetry={() => void fetchMore()} testID="gallery-loading-more" />
        }
        ListHeaderComponent={
          <>
            {summary !== null && <Text style={[type.subhead, styles.summary]}>{summary}</Text>}
            {people.length > 0 && (
              <View style={styles.people}>
                <PeopleRow people={people} selectedId={authorId} onSelect={setAuthorId} />
              </View>
            )}
            {header}
            {detail && <OriginalsNotice originals={detail.trip.originals} timeZone={detail.trip.timezone} style={styles.notice} />}
            {group && (
              <View style={styles.filter}>
                <Text style={[type.subhead, { color: colors.secondaryLabel }]}>{`Solo ${group.name}`}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quitar filtro de grupo"
                  hitSlop={10}
                  onPress={() => setGroupId(null)}
                >
                  <SymbolView name="xmark.circle.fill" size={18} tintColor={colors.tint as string} />
                </Pressable>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <Text style={[type.body, styles.empty]}>
            {author ? `${author.name} no sacó fotos` : "Este rollo no tiene fotos"}
          </Text>
        }
      />
    );

  // No wrapping View: the list must be the screen's first child for the native header to find it as the
  // main scroll view (large title collapses, edge effect). Stack.Screen and Toolbar render nothing.
  return (
    <>
      {body}
      {showToolbar && (
        <GalleryToolbar
          selecting={selecting}
          allSelected={allSelected}
          canSelectAll={complete}
          busy={busy}
          hasPhotos={photos.length > 0}
          canSaveAll={canSaveAll}
          groups={groups}
          groupId={groupId}
          onToggleAll={toggleAll}
          onStopSelecting={stopSelecting}
          onStartSelecting={startSelecting}
          onSelectGroup={setGroupId}
          onSaveAll={confirmSaveAll}
        />
      )}
      <SaveBar
        bar={bar}
        selecting={selecting}
        selectedCount={selected.size}
        canSave={!!saver}
        featureError={featureError}
        featureErrorDismissed={featureErrorDismissed}
        onDismissFeatureError={() => setFeatureErrorDismissed(true)}
        onSaveSelected={() => void run(photos.filter((p) => selected.has(p.id)))}
        onCancel={cancel}
        onRetry={(result) => void run(result.failed, { album: result.album, recents: result.recents })}
        onDismiss={dismiss}
      />
    </>
  );
}

const styles = StyleSheet.create({
  notice: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  filter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  summary: { color: colors.secondaryLabel, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  people: { paddingTop: spacing.md },
  hero: { paddingBottom: GAP },
  // Columns split the width evenly; the cell hugs the outer edge in the first and last column and sits centered in the
  // middle one, which leaves GAP between neighbours and none at the screen edges.
  slot: { alignItems: "center", paddingBottom: GAP },
  slotStart: { alignItems: "flex-start" },
  slotEnd: { alignItems: "flex-end" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  empty: {
    color: colors.secondaryLabel,
    textAlign: "center",
    padding: spacing.xl,
  },
});
