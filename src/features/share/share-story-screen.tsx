import * as Clipboard from "expo-clipboard";
import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import { useRevealedPhotos } from "@/features/media/revealed";
import { memberTotal } from "@/features/trips/member-total";
import { useFeed } from "@/features/trips/use-feed";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Footnote, Loading, Screen } from "@/ui/components";
import { colors, spacing, tintHex, type } from "@/ui/theme";
import { canShuffle, collageCandidates, collageCaption, nextSeed, pickCollage } from "./collage";
import { InstagramButton } from "./instagram-button";
import { inviteCaption, inviteLink, inviteSwatches } from "./invite";
import { renderCollageCard } from "./render-collage";
import { assetUri } from "./asset-uri";
import { renderInviteCard } from "./render-invite";
import { instagramStoriesAvailable, isShareCancel, shareMore, shareToInstagramStories } from "./share-story";
import { StoryPreview, STORY_RATIO } from "./story-preview";
import { DEFAULT_STYLE, STORY_STYLES, STYLE_ASSETS, STYLE_LABEL, STYLE_PALETTE, styleFromLabel } from "./story-style";
import { useStoryAssets } from "./use-story-assets";

const STYLE_LABELS = STORY_STYLES.map((s) => STYLE_LABEL[s]);
/** The preview never takes more than this share of the screen's height. */
const MAX_PREVIEW_HEIGHT = 0.62;

/** "Compartir": builds the Stories image (collage or invitation), previews it and offers Instagram Stories, the system sheet and, for the collage, another pick. */
export function ShareStoryScreen({ tripId, kind }: { tripId: string; kind: "collage" | "invite" }) {
  const { detail, error: detailError } = useTripDetail(tripId);
  const { photos, complete, loadAll } = useRevealedPhotos(tripId);
  const { feed, loading: feedLoading, error: feedError, refetch: refetchFeed } = useFeed(tripId, { mode: "all" });
  const [seed, setSeed] = useState(1);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const scheme = useColorScheme() ?? "light";
  const [loadedAll, setLoadedAll] = useState(false);
  const [instagram, setInstagram] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const { width, height } = useWindowDimensions();
  const isCollage = kind === "collage";

  useEffect(() => {
    let active = true;
    void instagramStoriesAvailable().then((available) => active && setInstagram(available));
    return () => {
      active = false;
    };
  }, []);

  // The collage picks from the whole roll: load the rest of the pages once (the build waits for them, or for the attempt to fail).
  const asked = useRef(false);
  useEffect(() => {
    if (!isCollage || feedLoading || complete || asked.current) return;
    asked.current = true;
    const done = () => setLoadedAll(true);
    loadAll().then(done, done);
  }, [isCollage, feedLoading, complete, loadAll]);

  const candidates = useMemo(() => collageCandidates(photos), [photos]);
  const thumbhashes = useMemo(() => feed?.items.map((i) => i.thumbhash) ?? [], [feed]);

  const ready = detail !== null && (isCollage ? complete || loadedAll : !feedLoading);
  // No photos because the feed failed to load is an error with a retry, not "no photos".
  const feedFailed = isCollage && !!feedError;
  const empty = isCollage && ready && candidates.length === 0 && !feedFailed;
  const build = useMemo(() => {
    if (!detail || !ready || empty || feedFailed) return null;
    const { trip } = detail;
    if (isCollage) {
      const caption = collageCaption({ startsAt: trip.startsAt, endsAt: trip.endsAt, timeZone: trip.timezone, people: memberTotal(detail) });
      return () => renderCollageCard({ name: trip.name, caption, photos: pickCollage(candidates, seed), style });
    }
    return () =>
      renderInviteCard({
        name: trip.name,
        caption: inviteCaption(detail),
        code: trip.joinCode,
        coverUrl: trip.coverUrl ?? null,
        swatches: inviteSwatches(thumbhashes),
        style,
      });
  }, [detail, ready, empty, feedFailed, isCollage, candidates, seed, thumbhashes, style]);

  const version = `${tripId}:${kind}:${isCollage ? seed : 0}`;
  const assets = useStoryAssets(build, version, kind, style);

  /** The invitation has no link inside the image: it travels with the share. `copy`: also in the clipboard (the system sheet doesn't touch it). */
  async function share(send: (link: string | undefined) => Promise<void>, copy: boolean) {
    if (!assets.stillUri || !assets.card || !detail) return;
    setShareFailed(false);
    try {
      const link = isCollage ? undefined : inviteLink(detail);
      if (link && copy) await Clipboard.setStringAsync(link);
      await send(link);
    } catch (e) {
      if (!isShareCancel(e)) setShareFailed(true);
    }
  }

  const shareStories = () =>
    share(
      async (link) =>
        shareToInstagramStories({
          stickerUri: assets.card!.uri,
          backgroundVideoUri: await assetUri(STYLE_ASSETS[style].video),
          backgroundColor: STYLE_PALETTE[style].base,
          linkText: link,
        }),
      false,
    );

  // Switching style redraws: until the new files exist the preview keeps the base color and video, and sharing waits.
  const filesReady = assets.card !== null && assets.stillUri !== null;
  const previewHeight = Math.min((width - spacing.md * 2) / STORY_RATIO, height * MAX_PREVIEW_HEIGHT);

  return (
    <Screen grouped>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>Cancelar</Stack.Toolbar.Button>
      </Stack.Toolbar>

      {!!detailError && <ErrorText>{detailError}</ErrorText>}
      {empty && <Footnote>Todavía no hay fotos para armar el collage.</Footnote>}
      {feedFailed && (
        <>
          <ErrorText>{feedError}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetchFeed()} />
        </>
      )}
      {assets.error && (
        <>
          <ErrorText>No se pudo armar la imagen. Probá de nuevo.</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={assets.retry} />
        </>
      )}
      {!detailError && !empty && !feedFailed && !assets.error && build === null && <Loading />}
      {build !== null && !assets.error && (
        <>
          <StoryPreview style={style} card={assets.card} height={previewHeight} />
          <SegmentedControl values={STYLE_LABELS} tintColor={tintHex[scheme]} selectedIndex={STORY_STYLES.indexOf(style)} onValueChange={(v) => setStyle(styleFromLabel(v))} />
          <View style={styles.actions}>
            {instagram && <InstagramButton disabled={!filesReady} onPress={() => void shareStories()} />}
            <Button label="Más opciones" disabled={!filesReady} variant={instagram ? "secondary" : "primary"} onPress={() => void share((link) => shareMore(assets.stillUri!, link), true)} />
            {isCollage && canShuffle(candidates) && (
              <Pressable accessibilityRole="button" onPress={() => setSeed((s) => nextSeed(candidates, s))} style={styles.shuffle}>
                <Text style={[type.body, { color: colors.tint }]}>Otras</Text>
              </Pressable>
            )}
          </View>
          {!isCollage && <Footnote>Copiamos el link. Pegalo en tu story con el sticker de Enlace</Footnote>}
          {shareFailed && <ErrorText>No se pudo compartir. Probá de nuevo.</ErrorText>}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  shuffle: { alignItems: "center", justifyContent: "center", minHeight: 44 },
});
