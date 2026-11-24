import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { Stack } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sendableGroups, isOrganizer } from "@/features/events/event";
import { filterByGroup } from "@/features/gallery/group";
import { toRevealedPhotos, useMediaToken, type RevealedPhoto } from "@/features/media/revealed";
import { useFeed } from "@/features/trips/use-feed";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Loading } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { canPick, pickCountLabel } from "./contest-state";
import { PickCell } from "./pick-cell";
import { useContest } from "./use-contest";
import { useToggleFinalist } from "./use-toggle-finalist";

const COLUMNS = 3;
const GAP = 2;
const keyExtractor = (photo: RevealedPhoto) => photo.id;

/**
 * "Elegí las finalistas" (organizers, between the end of the event and the reveal): every photo of the event in a grid,
 * tap to mark or unmark, with the count on top. The server's refusal (a 11th pick) shows inline.
 */
export function PicksScreen({ tripId }: { tripId: string }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { detail, error: detailError, refetch: refetchDetail } = useTripDetail(tripId);
  const organizer = !!detail && isOrganizer(detail);
  const { contest, error: contestError, refetch: refetchContest } = useContest(tripId, !!detail?.trip.contest?.enabled);
  const { feed, error: feedError, loading: feedLoading, refetch: refetchFeed, isRefetching: feedRefetching } = useFeed(tripId, { mode: "all" });
  const token = useMediaToken(tripId);
  const { toggle, error: toggleError } = useToggleFinalist(tripId);

  const [groupId, setGroupId] = useState<string | null>(null);
  const groups = useMemo(() => (detail ? sendableGroups(detail) : []), [detail]);
  // Photos only: videos can't be finalists.
  const photos = useMemo(() => toRevealedPhotos(feed?.items ?? []).filter((p) => p.type === "photo"), [feed]);
  // A feed cached before the preview window has photo items without files: wait for the refetch instead of calling it empty.
  const filesPending = photos.length === 0 && (feed?.items ?? []).some((i) => i.type === "photo");
  const shown = useMemo(() => filterByGroup(photos, groupId), [photos, groupId]);
  const picked = useMemo(() => new Set(contest?.finalists.map((f) => f.mediaId)), [contest]);
  const size = Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS);

  const onPress = useCallback(
    (photo: RevealedPhoto) => {
      if (picked.has(photo.id)) toggle({ add: false, mediaId: photo.id });
      else
        toggle({
          add: true,
          finalist: {
            mediaId: photo.id,
            author: { userId: photo.authorUserId, name: photo.author.name, avatarUrl: photo.author.avatarUrl ?? null },
            thumbHash: photo.thumbhash,
            width: photo.width,
            height: photo.height,
            thumbPath: photo.thumbPath,
            displayPath: photo.displayPath,
            votes: null,
          },
        });
    },
    [picked, toggle],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<RevealedPhoto>) => {
      const column = index % COLUMNS;
      return (
        <View style={[styles.slot, column === 0 ? styles.slotStart : column === COLUMNS - 1 ? styles.slotEnd : null]}>
          <PickCell photo={item} token={token} size={size} picked={picked.has(item.id)} onPress={onPress} />
        </View>
      );
    },
    [token, size, picked, onPress],
  );
  const listExtra = useMemo(() => ({ picked, token }), [picked, token]);

  const failure = detailError ?? contestError ?? feedError;
  if (failure)
    return (
      <View style={styles.center}>
        <ErrorText>{failure}</ErrorText>
        <Button label="Reintentar" variant="secondary" onPress={() => void Promise.all([refetchDetail(), refetchContest(), refetchFeed()])} />
      </View>
    );
  if (detail && !detail.trip.contest?.enabled)
    return (
      <View style={styles.center}>
        <Text style={[type.body, styles.note]}>Este evento no tiene concurso.</Text>
      </View>
    );
  if (!detail || !contest || feedLoading || (filesPending && feedRefetching)) return <Loading />;
  if (organizer && filesPending && canPick(contest, organizer))
    return (
      <View style={styles.center}>
        <ErrorText>No se pudieron cargar las fotos.</ErrorText>
        <Button label="Reintentar" variant="secondary" onPress={() => void refetchFeed()} />
      </View>
    );
  if (!organizer)
    return (
      <View style={styles.center}>
        <Text style={[type.body, styles.note]}>Solo quienes organizan eligen las finalistas.</Text>
      </View>
    );
  if (!canPick(contest, organizer))
    return (
      <View style={styles.center}>
        <Text style={[type.body, styles.note]}>Las finalistas se eligen entre el fin del evento y el revelado.</Text>
      </View>
    );

  const group = groups.find((g) => g.id === groupId);
  return (
    <>
      <FlashList
        testID="picks-list"
        data={shown}
        numColumns={COLUMNS}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={listExtra}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[type.title, { color: colors.label }]}>{pickCountLabel(contest.finalists.length)}</Text>
            <Text style={[type.footnote, { color: colors.secondaryLabel }]}>
              Tocá las fotos que van al concurso. Después del revelado, todos votan entre ellas.
            </Text>
            {group && <Text style={[type.subhead, { color: colors.secondaryLabel }]}>{`Solo ${group.name}`}</Text>}
            {!!toggleError && <ErrorText>{toggleError}</ErrorText>}
          </View>
        }
        ListEmptyComponent={<Text style={[type.body, styles.note, styles.empty]}>No hay fotos para elegir</Text>}
      />
      {groups.length > 1 && (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon="person.3" accessibilityLabel="Filtrar por grupo">
            <Stack.Toolbar.MenuAction isOn={groupId === null} onPress={() => setGroupId(null)}>
              Todos
            </Stack.Toolbar.MenuAction>
            {groups.map((g) => (
              <Stack.Toolbar.MenuAction key={g.id} isOn={groupId === g.id} onPress={() => setGroupId(g.id)}>
                {g.name}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, padding: spacing.md },
  // Columns split the width evenly; the cell hugs the outer edge in the first and last column, leaving GAP between neighbours.
  slot: { alignItems: "center", paddingBottom: GAP },
  slotStart: { alignItems: "flex-start" },
  slotEnd: { alignItems: "flex-end" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg },
  note: { color: colors.secondaryLabel, textAlign: "center" },
  empty: { padding: spacing.xl },
});
