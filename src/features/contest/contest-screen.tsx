import { useCallback, useMemo, useState } from "react";
import { Alert, Modal, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMe } from "@/features/auth/use-me";
import { isOrganizer } from "@/features/events/event";
import { useMediaToken } from "@/features/media/revealed";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Loading } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import type { ContestFinalist } from "./actions";
import { FinalistPager } from "./finalist-pager";
import { shuffledFinalists } from "./contest-state";
import { rankFinalists } from "./ranking";
import { ResultsList } from "./results-list";
import { useContest } from "./use-contest";
import { useWinnerReveal } from "./use-winner-reveal";
import { usePickWinner } from "./use-pick-winner";
import { useVote } from "./use-vote";

/**
 * The photo contest: the finalists in an order that's stable per viewer, vote one by one in the full-screen pager (`voting`/`closing`). While `tied` the
 * organizers pick the winner; once `closed` the winner is on top and every finalist shows its votes (the first time,
 * `useWinnerReveal` plays the winner reveal over it).
 */
export function ContestScreen({ tripId }: { tripId: string }) {
  const insets = useSafeAreaInsets();
  const { detail, error: detailError, refetch: refetchDetail } = useTripDetail(tripId);
  const { me } = useMe();
  const { contest, error: contestError, refetch: refetchContest } = useContest(tripId, !!detail?.trip.contest?.enabled);
  const token = useMediaToken(tripId);
  useWinnerReveal(tripId, contest);
  const { vote, error: voteError, clearError } = useVote(tripId);
  const { pick, picking, error: pickError } = usePickWinner(tripId);
  // Index (in rank order) of the result opened full screen.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const organizer = !!detail && isOrganizer(detail);
  const userId = me?.id ?? "";
  const ordered = useMemo(() => shuffledFinalists(contest?.finalists ?? [], userId), [contest, userId]);
  // Ids the server lists that this viewer can't see (hidden by blocks) are ignored.
  const tiedIds = useMemo(() => new Set(contest?.tiedMediaIds ?? []), [contest]);
  const pagerItems = useMemo(() => ordered.map((finalist) => ({ finalist })), [ordered]);
  const ranked = useMemo(() => rankFinalists(contest?.finalists ?? []), [contest]);
  // While tied the counts are hidden, so there's no place to show.
  const resultItems = useMemo(() => ranked.map(({ finalist, place }) => ({ finalist, place: finalist.votes === null ? undefined : place })), [ranked]);

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

  const failure = detailError ?? contestError;
  if (failure)
    return (
      <View style={styles.center}>
        <ErrorText>{failure}</ErrorText>
        <Button label="Reintentar" variant="secondary" onPress={() => void Promise.all([refetchDetail(), refetchContest()])} />
      </View>
    );
  if (detail && !detail.trip.contest?.enabled)
    return (
      <View style={styles.center}>
        <Text style={[type.body, styles.note]}>Este evento no tiene concurso.</Text>
      </View>
    );
  if (!detail || !contest) return <Loading />;
  if (status === "cancelled" || status === "pending" || status === "selecting")
    return (
      <View style={styles.center}>
        <Text style={[type.body, styles.note]}>{status === "cancelled" ? "El concurso se canceló." : "La votación todavía no empezó."}</Text>
      </View>
    );

  if (!token) return <Loading />;
  if (status === "voting" || status === "closing") {
    return (
      <View style={styles.pager}>
        <FinalistPager
          items={pagerItems}
          token={token}
          mode="vote"
          myVote={contest.myVote}
          myUserId={userId}
          onVote={vote}
          votingOpen={status === "voting"}
          closesAt={contest.closesAt}
          error={voteError}
          onIndexChange={clearError}
        />
      </View>
    );
  }
  return (
    <>
      <ResultsList
        ranked={ranked}
        winner={closed ? contest.winner : null}
        token={token}
        tiedIds={tied ? tiedIds : undefined}
        canPickWinner={canPickWinner}
        picking={picking}
        onPick={confirmWinner}
        onOpen={setOpenIndex}
        header={
          <>
            {tied && !organizer && <Text style={[type.body, styles.note]}>Hay un empate. Los organizadores eligen la ganadora.</Text>}
            {canPickWinner && <Text style={[type.body, styles.note]}>Hay un empate. Elegí la ganadora entre las empatadas.</Text>}
            {!!pickError && <ErrorText>{pickError}</ErrorText>}
          </>
        }
      />
      <Modal visible={openIndex !== null} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setOpenIndex(null)}>
        {openIndex !== null && (
          <View style={styles.pager}>
            <FinalistPager items={resultItems} initialIndex={openIndex} token={token} mode="results" myUserId={userId} topInset={insets.top} />
            <View style={[styles.close, { top: insets.top + spacing.lg }]}>
              <Button label="Cerrar" variant="secondary" size="small" onPress={() => setOpenIndex(null)} />
            </View>
          </View>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg },
  note: { color: colors.secondaryLabel },
  pager: { flex: 1 },
  close: { position: "absolute", right: spacing.md },
});
