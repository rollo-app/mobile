import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { Image } from "expo-image";
import { memo, useCallback, useMemo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mediaSource } from "@/features/media/revealed";
import { Avatar } from "@/features/profile/avatar";
import { Button } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import type { Contest, ContestFinalist } from "./actions";
import { authorHandle, votesLabel } from "./contest-state";
import type { RankedFinalist } from "./ranking";

const keyExtractor = (item: RankedFinalist) => item.finalist.mediaId;

type Props = {
  /** Sorted by place (see `rankFinalists`). */
  ranked: RankedFinalist[];
  /** Set once `closed`; its finalist (when visible to this viewer) is shown big on top. */
  winner: Contest["winner"];
  token: string;
  /** While `tied`: the finalists that tie. Their rows are marked and, for organizers, get "Elegir ganadora". */
  tiedIds?: ReadonlySet<string>;
  canPickWinner?: boolean;
  picking?: boolean;
  onPick?: (finalist: ContestFinalist) => void;
  /** Index in `ranked` of the tapped row. */
  onOpen: (index: number) => void;
  /** Tapping the winner's avatar or name opens their profile (the rows open the photo). */
  onOpenAuthor?: (userId: string) => void;
  /** Notes / errors above the winner. */
  header?: ReactNode;
};

type RowProps = {
  item: RankedFinalist;
  index: number;
  token: string;
  tied: boolean;
  canPick: boolean;
  picking: boolean;
  onPick?: (finalist: ContestFinalist) => void;
  onOpen: (index: number) => void;
};

const Row = memo(function Row({ item, index, token, tied, canPick, picking, onPick, onOpen }: RowProps) {
  const { finalist, place, share } = item;
  const votes = finalist.votes;
  const handle = authorHandle(finalist.author);
  const label = votes !== null ? `${place}° puesto, ${handle}, ${votesLabel(votes)}` : tied ? `${handle}, empatada` : handle;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => onOpen(index)}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
      >
        {votes !== null && <Text style={[type.headline, styles.place]}>{`${place}°`}</Text>}
        <Image
          testID={`contest-thumb-${finalist.mediaId}`}
          source={mediaSource(finalist.thumbPath, token)}
          placeholder={finalist.thumbHash ? { thumbhash: finalist.thumbHash } : undefined}
          transition={120}
          contentFit="cover"
          recyclingKey={finalist.mediaId}
          style={styles.thumb}
        />
        <View style={styles.rowText}>
          <AuthorNames author={finalist.author} nameStyle={type.subhead} />
          {tied && <Text style={[type.footnote, { color: colors.tint }]}>Empatada</Text>}
          {votes !== null && (
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${Math.round(share * 100)}%` }]} />
            </View>
          )}
        </View>
        {votes !== null && <Text style={[type.subhead, styles.votes]}>{votesLabel(votes)}</Text>}
      </Pressable>
      {canPick && <Button label="Elegir ganadora" size="small" loading={picking} onPress={() => onPick?.(finalist)} />}
    </View>
  );
});

/** The person's name, and their @username under it, smaller and dimmer (when they have one). */
function AuthorNames({ author, nameStyle }: { author: { name: string; username: string | null }; nameStyle: TextStyle }) {
  return (
    <>
      <Text style={[nameStyle, { color: colors.label }]} numberOfLines={1}>
        {author.name}
      </Text>
      {!!author.username && (
        <Text style={[type.footnote, { color: colors.secondaryLabel }]} numberOfLines={1}>
          {`@${author.username}`}
        </Text>
      )}
    </>
  );
}

/** The contest's results: the winner big on top, then every finalist by votes with a proportional bar. In a tie the tied ones can be picked. */
export function ResultsList({ ranked, winner, token, tiedIds, canPickWinner = false, picking = false, onPick, onOpen, onOpenAuthor, header }: Props) {
  const insets = useSafeAreaInsets();
  const winnerFinalist = useMemo(() => (winner ? ranked.find((r) => r.finalist.mediaId === winner.mediaId)?.finalist : undefined), [ranked, winner]);
  const winnerVotes = winnerFinalist?.votes;

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<RankedFinalist>) => {
      const tied = !!tiedIds?.has(item.finalist.mediaId);
      return <Row item={item} index={index} token={token} tied={tied} canPick={canPickWinner && tied} picking={picking} onPick={onPick} onOpen={onOpen} />;
    },
    [token, tiedIds, canPickWinner, picking, onPick, onOpen],
  );
  const extra = useMemo(() => ({ token, tiedIds, canPickWinner, picking }), [token, tiedIds, canPickWinner, picking]);

  return (
    <FlashList
      testID="contest-list"
      data={ranked}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      extraData={extra}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.lg }}
      ListHeaderComponent={
        <View style={styles.header}>
          {header}
          {!!winner && (
            <View style={styles.winner}>
              {!!winnerFinalist && (
                <Image
                  testID="contest-winner"
                  source={mediaSource(winnerFinalist.displayPath, token)}
                  placeholder={winnerFinalist.thumbHash ? { thumbhash: winnerFinalist.thumbHash } : undefined}
                  contentFit="cover"
                  style={styles.winnerImage}
                />
              )}
              <Text style={[type.footnote, styles.seal]}>Ganadora</Text>
              <Pressable
                style={styles.winnerAuthor}
                disabled={!onOpenAuthor}
                accessibilityRole="link"
                accessibilityLabel={`Ver el perfil de ${winner.author.name}`}
                onPress={() => onOpenAuthor?.(winner.author.userId)}
              >
                <Avatar id={winner.author.userId} name={winner.author.name} avatarUrl={winner.author.avatarUrl} size={40} />
                <View style={styles.rowText}>
                  <AuthorNames author={winner.author} nameStyle={type.title} />
                  {typeof winnerVotes === "number" && <Text style={[type.subhead, styles.votesPlain]}>{votesLabel(winnerVotes)}</Text>}
                </View>
              </Pressable>
            </View>
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, paddingVertical: spacing.md },
  winner: { gap: spacing.sm },
  winnerImage: { width: "100%", aspectRatio: 1, borderRadius: 14, borderCurve: "continuous", backgroundColor: colors.latent },
  seal: { alignSelf: "flex-start", color: colors.onTint, backgroundColor: colors.tint, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 8, overflow: "hidden", fontWeight: "600" },
  winnerAuthor: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  row: { gap: spacing.sm, paddingVertical: spacing.sm },
  rowMain: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pressed: { opacity: 0.7 },
  place: { width: 24, textAlign: "center", color: colors.secondaryLabel, fontVariant: ["tabular-nums"] },
  thumb: { width: 56, height: 56, borderRadius: 8, borderCurve: "continuous", backgroundColor: colors.latent },
  rowText: { flex: 1, gap: 4 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.latent, overflow: "hidden" },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.tint },
  votes: { color: colors.label, fontVariant: ["tabular-nums"] },
  votesPlain: { color: colors.secondaryLabel, fontVariant: ["tabular-nums"] },
});
