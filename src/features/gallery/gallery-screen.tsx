import { OriginalsNotice } from "@/features/trips/originals-notice-text";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMe } from "@/features/auth/use-me";
import { sendableGroups } from "@/features/events/event";
import { useToggleFeatured } from "@/features/featured/use-toggle-featured";
import { useRevealedPhotos, type RevealedPhoto } from "@/features/media/revealed";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText } from "@/ui/components";
import { LoadMoreFooter } from "@/ui/load-more-footer";
import { colors, spacing, type } from "@/ui/theme";
import { Cell } from "./gallery-cell";
import { GalleryToolbar } from "./gallery-toolbar";
import { authorsOf, chunkRows, filterByAuthor, filterByGroup, groupByDay } from "./group";
import { SaveBar } from "./save-bar";
import { useArchivePhoto } from "./use-archive-photo";
import { useBulkSave } from "./use-bulk-save";
import { useDeletePhoto } from "./use-delete-photo";
import { useGallerySelection } from "./use-gallery-selection";
import { useSaver } from "./use-saver";

const COLUMNS = 3;
const GAP = 2;

/**
 * Revealed roll: grid grouped by day, filter by person, and downloads to Photos. `toolbar` false hides
 * its header buttons while it stays mounted behind another view.
 */
const ENDING_THRESHOLD = 1.5;

export function GalleryScreen({
  tripId,
  toolbar: showToolbar = true,
  onSelectionChange,
}: {
  tripId: string;
  toolbar?: boolean;
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
  const sections = useMemo(
    () =>
      groupByDay(shown).map((s) => ({
        title: s.title,
        data: chunkRows(s.photos, COLUMNS),
      })),
    [shown],
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

  let body;
  if (loading) body = <ActivityIndicator style={{ marginTop: spacing.xl }} />;
  else if (error && photos.length === 0)
    body = (
      <View style={styles.center}>
        <ErrorText>{error}</ErrorText>
        <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} />
      </View>
    );
  else if (photos.length === 0 && (hasMore || loadingMore) && !loadMoreError)
    body = <ActivityIndicator style={{ marginTop: spacing.xl }} />;
  else if (photos.length === 0)
    body = (
      <View style={styles.center}>
        <Text style={[type.body, { color: colors.secondaryLabel }]}>Este rollo no tiene fotos</Text>
      </View>
    );
  else
    body = (
      <SectionList
        testID="gallery-list"
        sections={sections}
        keyExtractor={(row) => row[0]!.id}
        stickySectionHeadersEnabled={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        extraData={[selecting, selected, token, revealed, me?.id]}
        onEndReached={onEndReached}
        onEndReachedThreshold={ENDING_THRESHOLD}
        ListFooterComponent={
          <LoadMoreFooter loading={loadingMore} error={loadMoreError} onRetry={() => void fetchMore()} testID="gallery-loading-more" />
        }
        ListHeaderComponent={
          <>
            {detail && <OriginalsNotice originals={detail.trip.originals} timeZone={detail.trip.timezone} style={styles.notice} />}
            {author && (
              <View style={styles.filter}>
                <Text style={[type.subhead, { color: colors.secondaryLabel }]}>{`Solo ${author.name}`}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quitar filtro"
                  hitSlop={10}
                  onPress={() => setAuthorId(null)}
                >
                  <SymbolView name="xmark.circle.fill" size={18} tintColor={colors.tint as string} />
                </Pressable>
              </View>
            )}
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
        renderSectionHeader={({ section }) => (
          <Text accessibilityRole="header" style={[type.headline, styles.header]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item: row }) => (
          <View style={styles.row}>
            {row.map((photo) => (
              <Cell
                key={photo.id}
                photo={photo}
                token={token}
                size={size}
                selecting={selecting}
                selected={selected.has(photo.id)}
                own={revealed && !!me && photo.authorUserId === me.id}
                onPress={onCellPress}
                onToggleFeatured={onToggleFeatured}
                onOwnAction={onOwnAction}
              />
            ))}
          </View>
        )}
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
          authors={authors}
          authorId={authorId}
          groups={groups}
          groupId={groupId}
          onToggleAll={toggleAll}
          onStopSelecting={stopSelecting}
          onStartSelecting={startSelecting}
          onSelectAuthor={setAuthorId}
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
  header: {
    color: colors.label,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  row: { flexDirection: "row", gap: GAP, marginBottom: GAP },
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
