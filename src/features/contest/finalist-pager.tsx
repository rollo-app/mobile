import { FlashList, type FlashListRef, type ListRenderItemInfo } from "@shopify/flash-list";
import { Image } from "expo-image";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mediaSource } from "@/features/media/revealed";
import { Avatar } from "@/features/profile/avatar";
import { colors, spacing, type } from "@/ui/theme";
import type { ContestFinalist } from "./actions";
import { authorHandle, countdownLabel, votesLabel } from "./contest-state";
import { PagerProgress } from "./pager-progress";

/** One page of the pager. `place` (1 = winner) is only used in `results` mode. */
export type PagerItem = { finalist: ContestFinalist; place?: number };

export type FinalistPagerProps = {
  /** In the order to show them (the screen shuffles for voting and sorts by place for the results). */
  items: PagerItem[];
  initialIndex?: number;
  token: string;
  /** `vote`: countdown + vote button. `results`: "{p}° puesto" on top and the votes big at the bottom. */
  mode: "vote" | "results";
  myVote?: string | null;
  myUserId: string;
  /** A finalist's `mediaId` to vote it, `null` to take the vote back. */
  onVote?: (mediaId: string | null) => void;
  /** False while the contest is `closing`: the button reads "Cerrando la votación…" and does nothing. */
  votingOpen?: boolean;
  /** Epoch ms when the voting closes (for "Cierra en …"). */
  closesAt?: number | null;
  onIndexChange?: (index: number) => void;
  /** A refused vote's message, shown above the button on the page you're looking at. */
  error?: string | null;
  /** Pushes the progress (and the place) down, for a pager shown where the status bar overlaps it (a full-screen modal). */
  topInset?: number;
  /** Tapping the author (avatar or name) opens their profile. */
  onOpenAuthor?: (userId: string) => void;
};

// Soft fades so the white text reads on any photo: a short one on top (progress), a longer one behind the author and button.
const TOP_SCRIM = "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 100%)";
const BOTTOM_SCRIM = "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%)";

const TOP_SCRIM_HEIGHT = 110;
const PLACE_TOP = 72;

const keyExtractor = (item: PagerItem) => item.finalist.mediaId;

/** Re-renders every `ms` so the countdown moves while the screen stays open. */
function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/**
 * Full-screen finalists, one per page, swiping sideways. A horizontal paged FlashList (not a ScrollView): a contest has
 * no cap on finalists and each page holds a full-size photo, so only the pages around the visible one stay mounted.
 */
export function FinalistPager({ items, initialIndex = 0, token, mode, myVote, myUserId, onVote, votingOpen = true, closesAt = null, onIndexChange, error = null, topInset = 0, onOpenAuthor }: FinalistPagerProps) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [box, setBox] = useState({ width: window.width, height: window.height });
  const start = Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0));
  const [index, setIndex] = useState(start);
  const now = useNow(30_000);
  const widthRef = useRef(box.width);
  widthRef.current = box.width;
  const listRef = useRef<FlashListRef<PagerItem>>(null);
  const indexRef = useRef(start);
  indexRef.current = index;

  // Tapping the photo moves like the stories: right side → next, left third → previous.
  const step = useCallback(
    (dir: -1 | 1) => {
      const next = indexRef.current + dir;
      if (next < 0 || next >= items.length) return;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setIndex(next);
      onIndexChange?.(next);
    },
    [items.length, onIndexChange],
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.min(Math.max(Math.round(e.nativeEvent.contentOffset.x / widthRef.current), 0), items.length - 1);
      setIndex(next);
      onIndexChange?.(next);
    },
    [items.length, onIndexChange],
  );

  const countdown = countdownLabel(closesAt, now);
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<PagerItem>) => (
      <Page
        finalist={item.finalist}
        place={item.place}
        mode={mode}
        token={token}
        width={box.width}
        height={box.height}
        mine={item.finalist.author.userId === myUserId}
        voted={myVote === item.finalist.mediaId}
        error={item.finalist.mediaId === items[index]?.finalist.mediaId ? error : null}
        votingOpen={votingOpen}
        countdown={countdown}
        bottomInset={insets.bottom}
        topInset={topInset}
        onVote={onVote}
        onStep={step}
        onOpenAuthor={onOpenAuthor}
      />
    ),
    [mode, token, box.width, box.height, myUserId, myVote, votingOpen, countdown, insets.bottom, topInset, onVote, step, onOpenAuthor, error, index, items],
  );
  const extra = useMemo(() => ({ myVote, votingOpen, countdown, token, width: box.width, height: box.height, error, index }), [myVote, votingOpen, countdown, token, box.width, box.height, error, index]);

  return (
    <View style={styles.root} onLayout={onLayout}>
      <FlashList
        ref={listRef}
        testID="finalist-pager"
        data={items}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={start}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={extra}
        onMomentumScrollEnd={onMomentumScrollEnd}
      />
      <View pointerEvents="none" style={[styles.topScrim, { height: TOP_SCRIM_HEIGHT + topInset }]} />
      <View testID="pager-progress" pointerEvents="none" style={[styles.progress, { top: topInset + spacing.sm }]}>
        <PagerProgress count={items.length} index={index} showTitle={mode === "vote"} />
      </View>
    </View>
  );
}

type PageProps = {
  finalist: ContestFinalist;
  place?: number;
  error: string | null;
  mode: "vote" | "results";
  token: string;
  width: number;
  height: number;
  mine: boolean;
  voted: boolean;
  votingOpen: boolean;
  countdown: string;
  bottomInset: number;
  topInset: number;
  onVote?: (mediaId: string | null) => void;
  onStep: (dir: -1 | 1) => void;
  onOpenAuthor?: (userId: string) => void;
};

const Page = memo(function Page({ finalist, place, error, mode, token, width, height, mine, voted, votingOpen, countdown, bottomInset, topInset, onVote, onStep, onOpenAuthor }: PageProps) {
  const source = useMemo(() => mediaSource(finalist.displayPath, token), [finalist.displayPath, token]);
  const { author } = finalist;
  const label = voted ? "Tu voto ✓" : votingOpen ? "Votar esta" : "Cerrando la votación…";
  const disabled = mine || !votingOpen;
  const handle = authorHandle(author);
  return (
    <View style={{ width, height, backgroundColor: colors.latent }}>
      <Image
        testID={`finalist-image-${finalist.mediaId}`}
        source={source}
        placeholder={finalist.thumbHash ? { thumbhash: finalist.thumbHash } : undefined}
        contentFit="cover"
        recyclingKey={finalist.mediaId}
        transition={150}
        style={StyleSheet.absoluteFill}
      />
      <Pressable
        testID={`finalist-tap-${finalist.mediaId}`}
        style={StyleSheet.absoluteFill}
        accessible={false}
        onPress={(e) => onStep(e.nativeEvent.locationX < width / 3 ? -1 : 1)}
      />
      {mode === "results" && !!place && <Text pointerEvents="none" style={[type.title, styles.place, { top: PLACE_TOP + topInset }]}>{`${place}° puesto`}</Text>}
      <View style={[styles.bottom, styles.bottomScrim, { paddingBottom: bottomInset + spacing.md }]}>
        <Pressable
          style={styles.author}
          disabled={!onOpenAuthor}
          accessibilityRole="link"
          accessibilityLabel={`Ver el perfil de ${author.name}`}
          onPress={() => onOpenAuthor?.(author.userId)}
        >
          <Avatar id={author.userId} name={author.name} avatarUrl={author.avatarUrl} size={40} />
          <View style={styles.names}>
            <Text style={[type.headline, styles.onPhoto]} numberOfLines={1}>
              {author.name}
            </Text>
            {!!author.username && (
              <Text style={[type.footnote, styles.username]} numberOfLines={1} accessibilityLabel={handle}>
                {`@${author.username}`}
              </Text>
            )}
          </View>
        </Pressable>
        {mode === "results" ? (
          finalist.votes !== null && <Text style={styles.votes}>{votesLabel(finalist.votes)}</Text>
        ) : (
          <>
            {!!countdown && votingOpen && <Text style={[type.footnote, styles.onPhoto]}>{countdown}</Text>}
            {mine && <Text style={[type.footnote, styles.onPhoto]}>No podés votar tu propia foto</Text>}
            {!!error && <Text style={[type.footnote, styles.error]}>{error}</Text>}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityHint={mine ? "No podés votar tu propia foto" : voted ? "Tocá para sacar tu voto" : undefined}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => onVote?.(voted ? null : finalist.mediaId)}
              style={[styles.vote, { backgroundColor: voted ? "rgba(255,255,255,0.25)" : colors.tint, opacity: disabled && !voted ? 0.5 : 1 }]}
            >
              <Text style={[type.headline, { color: colors.onTint }]}>{label}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  progress: { position: "absolute", left: spacing.md, right: spacing.md },
  place: { position: "absolute", left: spacing.md, color: colors.onTint, textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 6 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.xl },
  bottomScrim: { backgroundImage: BOTTOM_SCRIM },
  topScrim: { position: "absolute", top: 0, left: 0, right: 0, backgroundImage: TOP_SCRIM },
  error: { color: "#FF9F9A", fontWeight: "600" },
  author: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  onPhoto: { color: colors.onTint, flexShrink: 1 },
  names: { flexShrink: 1 },
  username: { color: "rgba(255,255,255,0.7)" },
  votes: { color: colors.onTint, fontSize: 44, fontWeight: "700", fontVariant: ["tabular-nums"] },
  vote: { alignItems: "center", justifyContent: "center", height: 54, borderRadius: 14, borderCurve: "continuous" },
});
