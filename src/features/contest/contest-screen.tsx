import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useCallback, useMemo, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMe } from "@/features/auth/use-me";
import { isOrganizer } from "@/features/events/event";
import { mediaSource, useMediaToken } from "@/features/media/revealed";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Loading } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import type { ContestFinalist } from "./actions";
import { shuffledFinalists } from "./contest-state";
import { useContest } from "./use-contest";
import { usePickWinner } from "./use-pick-winner";
import { useVote } from "./use-vote";

const COLUMNS = 2;
const GAP = spacing.sm;
const keyExtractor = (f: ContestFinalist) => f.mediaId;
const votesLabel = (n: number) => `${n} ${n === 1 ? "voto" : "votos"}`;

/**
 * The photo contest: the finalists in an order that's stable per viewer, tap one to see it big and vote. While `tied` the
 * organizers pick the winner; once `closed` the winner is on top and every finalist shows its votes.
 */
export function ContestScreen({ tripId }: { tripId: string }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { detail, error: detailError, refetch: refetchDetail } = useTripDetail(tripId);
  const { me } = useMe();
  const { contest, error: contestError, refetch: refetchContest } = useContest(tripId, !!detail?.trip.contest?.enabled);
  const token = useMediaToken(tripId);
  const { vote, error: voteError, clearError } = useVote(tripId);
  const { pick, picking, error: pickError } = usePickWinner(tripId);
  const [openId, setOpenId] = useState<string | null>(null);

  const organizer = !!detail && isOrganizer(detail);
  const userId = me?.id ?? "";
  const ordered = useMemo(() => shuffledFinalists(contest?.finalists ?? [], userId), [contest, userId]);
  // Ids the server lists that this viewer can't see (hidden by blocks) are ignored.
  const tiedIds = useMemo(() => new Set(contest?.tiedMediaIds ?? []), [contest]);
  const size = Math.floor((width - spacing.md * 2 - GAP * (COLUMNS - 1)) / COLUMNS);
  const open = ordered.find((f) => f.mediaId === openId) ?? null;

  const confirmWinner = useCallback(
    (finalist: ContestFinalist) =>
      Alert.alert("¿Elegir esta foto como ganadora?", `Es la foto de ${finalist.author.name}. No se puede cambiar después.`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Elegir ganadora", onPress: () => pick(finalist.mediaId) },
      ]),
    [pick],
  );

  const status = contest?.status;
  const closed = status === "closed";
  const tied = status === "tied";
  const canPickWinner = organizer && tied;

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ContestFinalist>) => (
      <View style={[styles.cell, { width: size }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Foto de ${item.author.name}`}
          accessibilityState={{ selected: contest?.myVote === item.mediaId }}
          onPress={() => {
            clearError();
            setOpenId(item.mediaId);
          }}
          style={{ width: size, height: size, borderRadius: 10, borderCurve: "continuous", overflow: "hidden", backgroundColor: colors.latent }}
        >
          {!!token && (
            <Image
              testID={`contest-thumb-${item.mediaId}`}
              source={mediaSource(item.thumbPath, token)}
              placeholder={item.thumbHash ? { thumbhash: item.thumbHash } : undefined}
              transition={120}
              contentFit="cover"
              recyclingKey={item.mediaId}
              style={StyleSheet.absoluteFill}
            />
          )}
        </Pressable>
        <Text style={[type.footnote, { color: colors.secondaryLabel }]} numberOfLines={1}>
          {contest?.myVote === item.mediaId ? `${item.author.name} · Tu voto ✓` : item.author.name}
        </Text>
        {item.votes !== null && <Text style={[type.subhead, { color: colors.label, fontVariant: ["tabular-nums"] }]}>{votesLabel(item.votes)}</Text>}
        {canPickWinner && tiedIds.has(item.mediaId) && (
          <Button label="Elegir ganadora" size="small" loading={picking} onPress={() => confirmWinner(item)} />
        )}
      </View>
    ),
    [size, token, contest?.myVote, canPickWinner, tiedIds, picking, confirmWinner, clearError],
  );
  const listExtra = useMemo(() => ({ token, mine: contest?.myVote, tiedIds, picking, canPickWinner }), [token, contest?.myVote, tiedIds, picking, canPickWinner]);

  const failure = detailError ?? contestError;
  if (failure)
    return (
      <View style={styles.center}>
        <ErrorText>{failure}</ErrorText>
        <Button label="Reintentar" variant="secondary" onPress={() => void Promise.all([refetchDetail(), refetchContest()])} />
      </View>
    );
  if (!detail || !contest) return <Loading />;
  if (status === "cancelled" || status === "pending" || status === "selecting")
    return (
      <View style={styles.center}>
        <Text style={[type.body, styles.note]}>{status === "cancelled" ? "El concurso se canceló." : "La votación todavía no empezó."}</Text>
      </View>
    );

  const winner = closed && contest.winner ? contest.finalists.find((f) => f.mediaId === contest.winner!.mediaId) : undefined;
  const votingOpen = status === "voting";
  return (
    <>
      <FlashList
        testID="contest-list"
        data={ordered}
        numColumns={COLUMNS}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={listExtra}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.lg }}
        ListHeaderComponent={
          <View style={styles.header}>
            {status === "closing" && <Text style={[type.title, { color: colors.label }]}>Cerrando la votación…</Text>}
            {votingOpen && <Text style={[type.footnote, { color: colors.secondaryLabel }]}>Tocá una foto para verla en grande y votar. Un voto por persona.</Text>}
            {tied && !organizer && <Text style={[type.body, styles.note]}>Hay un empate. Los organizadores eligen la ganadora.</Text>}
            {canPickWinner && <Text style={[type.body, styles.note]}>Hay un empate. Elegí la ganadora entre las empatadas.</Text>}
            {!!pickError && <ErrorText>{pickError}</ErrorText>}
            {!!winner && !!token && (
              <View style={styles.winner}>
                <Image
                  testID="contest-winner"
                  source={mediaSource(winner.displayPath, token)}
                  placeholder={winner.thumbHash ? { thumbhash: winner.thumbHash } : undefined}
                  contentFit="cover"
                  style={styles.winnerImage}
                />
                <Text style={[type.title, { color: colors.label }]}>{`Ganó la foto de ${winner.author.name}`}</Text>
              </View>
            )}
            {closed && !winner && !!contest.winner && <Text style={[type.title, { color: colors.label }]}>{`Ganó la foto de ${contest.winner.author.name}`}</Text>}
          </View>
        }
      />
      <Modal visible={!!open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpenId(null)}>
        {!!open && (
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <View style={styles.sheetBar}>
              <Button label="Cerrar" variant="secondary" size="small" onPress={() => setOpenId(null)} />
            </View>
            {!!token && (
              <Image
                testID="contest-large"
                source={mediaSource(open.displayPath, token)}
                placeholder={open.thumbHash ? { thumbhash: open.thumbHash } : undefined}
                contentFit="contain"
                style={styles.large}
              />
            )}
            <Text style={[type.headline, { color: colors.label }]}>{`Foto de ${open.author.name}`}</Text>
            {open.votes !== null && <Text style={[type.subhead, { color: colors.secondaryLabel }]}>{votesLabel(open.votes)}</Text>}
            {!!voteError && <ErrorText>{voteError}</ErrorText>}
            {(votingOpen || status === "closing") && (
              <VoteButton
                finalist={open}
                mine={open.author.userId === userId}
                voted={contest.myVote === open.mediaId}
                enabled={votingOpen}
                onVote={vote}
              />
            )}
          </View>
        )}
      </Modal>
    </>
  );
}

function VoteButton({
  finalist,
  mine,
  voted,
  enabled,
  onVote,
}: {
  finalist: ContestFinalist;
  mine: boolean;
  voted: boolean;
  enabled: boolean;
  onVote: (mediaId: string | null) => void;
}) {
  const disabled = mine || !enabled;
  const label = voted ? "Tu voto ✓" : "Votar esta";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={mine ? "No podés votar tu propia foto" : voted ? "Tocá para sacar tu voto" : undefined}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onVote(voted ? null : finalist.mediaId)}
      style={[styles.vote, { backgroundColor: voted ? colors.fill : colors.tint, opacity: disabled ? 0.35 : 1 }]}
    >
      <Text style={[type.headline, { color: voted ? colors.label : colors.onTint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, paddingVertical: spacing.md },
  cell: { gap: 2, paddingBottom: spacing.md, marginRight: GAP },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg },
  note: { color: colors.secondaryLabel },
  winner: { gap: spacing.sm },
  winnerImage: { width: "100%", aspectRatio: 1, borderRadius: 14, borderCurve: "continuous", backgroundColor: colors.latent },
  sheet: { flex: 1, gap: spacing.sm, padding: spacing.md, backgroundColor: colors.background },
  sheetBar: { alignItems: "flex-end" },
  large: { flex: 1 },
  vote: { alignItems: "center", justifyContent: "center", height: 50, borderRadius: 14, borderCurve: "continuous" },
});
