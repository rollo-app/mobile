import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { mediaSource, useMediaToken } from "@/features/media/revealed";
import { Avatar } from "@/features/profile/avatar";
import { colors, spacing, type } from "@/ui/theme";
import { cardCopy } from "./contest-state";
import { useContest } from "./use-contest";
import { useWinnerReveal } from "./use-winner-reveal";

/**
 * "Concurso de fotos" card for the top of the Galería and the Rollo segment: the countdown while voting, the winner once
 * closed. Nothing for events without a contest or before the voting opens. Tapping opens `/contest`. The first time it
 * sees the contest closed, while its screen is in view, it plays the winner reveal (`useWinnerReveal`).
 */
export function ContestCard({
  tripId,
  enabled,
  focused,
  style,
}: {
  tripId: string;
  enabled: boolean;
  /** Whether the screen holding the card is the one in view (`useIsFocused()`): the winner reveal only opens then. */
  focused: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  const { contest } = useContest(tripId, enabled);
  useWinnerReveal(enabled ? tripId : undefined, contest, focused);
  const token = useMediaToken(enabled ? tripId : undefined);
  const copy = enabled ? cardCopy(contest, Date.now()) : null;
  if (!copy) return null;

  const winnerId = contest?.status === "closed" && contest.winner?.imageAvailable ? contest.winner.mediaId : null;
  const thumb = winnerId ? contest?.finalists.find((f) => f.mediaId === winnerId) : undefined;
  const winnerAuthor = contest?.status === "closed" ? contest.winner?.author : undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy}
      onPress={() => router.push({ pathname: "/contest", params: { trip: tripId } })}
      style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}
    >
      {!!thumb && !!token ? (
        <Image
          testID="contest-card-winner"
          source={mediaSource(thumb.thumbPath, token)}
          placeholder={thumb.thumbHash ? { thumbhash: thumb.thumbHash } : undefined}
          contentFit="cover"
          style={styles.thumb}
        />
      ) : (
        <SymbolView name="trophy" size={24} tintColor={colors.tint as string} />
      )}
      <View style={styles.text}>
        <Text style={[type.headline, { color: colors.label }]}>{copy}</Text>
        {!!winnerAuthor && (
          <View style={styles.byline}>
            <Avatar id={winnerAuthor.userId} name={winnerAuthor.name} avatarUrl={winnerAuthor.avatarUrl} size={22} />
            <Text style={[type.footnote, { color: colors.secondaryLabel }]}>Tocá para ver los votos</Text>
          </View>
        )}
      </View>
      <SymbolView name="chevron.right" size={14} tintColor={colors.tertiaryLabel as string} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: colors.cell,
  },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 2 },
  byline: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  thumb: { width: 48, height: 48, borderRadius: 8, borderCurve: "continuous", backgroundColor: colors.latent },
});
