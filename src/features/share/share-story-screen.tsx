import * as Burnt from "burnt";
import * as Clipboard from "expo-clipboard";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRevealedPhotos } from "@/features/media/revealed";
import { memberTotal } from "@/features/trips/member-total";
import { useFeed } from "@/features/trips/use-feed";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { ErrorText, Footnote, Loading } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { collageCandidates, collageCaption } from "./collage";
import { collagePhotos, useCollageSelection } from "./collage-selection";
import { inviteCaption, inviteLink, inviteSwatches } from "./invite";
import { renderCollageCard } from "./render-collage";
import { assetUri } from "./asset-uri";
import { renderInviteCard } from "./render-invite";
import { instagramStoriesAvailable, isShareCancel, shareImageToWhatsApp, shareMore, shareToInstagramStories, whatsAppAvailable } from "./share-story";
import { CollageStrip } from "./collage-strip";
import { SharePills } from "./share-pills";
import { StyleChips } from "./style-chips";
import { StoryPreview, STORY_RATIO } from "./story-preview";
import { DEFAULT_STYLE, STYLE_ASSETS, STYLE_PALETTE } from "./story-style";
import { useStoryAssets } from "./use-story-assets";
import { RetryPill } from "./retry-pill";

/** Fixed seed: with no selection, the collage is always the same random pick. */
const SEED = 1;

/** "Compartir": builds the Stories image (collage or invitation), previews it and offers Instagram Stories, the system sheet and, for the collage, choosing the photos. */
export function ShareStoryScreen({ tripId, kind }: { tripId: string; kind: "collage" | "invite" }) {
  const { detail, error: detailError } = useTripDetail(tripId);
  const { photos, token, complete, loadAll } = useRevealedPhotos(tripId);
  const { feed, loading: feedLoading, error: feedError, refetch: refetchFeed } = useFeed(tripId, { mode: "all" });
  const selection = useCollageSelection(tripId);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [loadedAll, setLoadedAll] = useState(false);
  const [instagram, setInstagram] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const insets = useSafeAreaInsets();
  const [area, setArea] = useState({ width: 0, height: 0 });
  const isCollage = kind === "collage";

  useEffect(() => {
    let active = true;
    void instagramStoriesAvailable().then((available) => active && setInstagram(available));
    void whatsAppAvailable().then((available) => active && setWhatsapp(available));
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
  const stripPhotos = useMemo(() => (isCollage ? collagePhotos(candidates, selection, SEED) : []), [isCollage, candidates, selection]);
  const build = useMemo(() => {
    if (!detail || !ready || empty || feedFailed) return null;
    const { trip } = detail;
    if (isCollage) {
      const caption = collageCaption({ startsAt: trip.startsAt, endsAt: trip.endsAt, timeZone: trip.timezone, people: memberTotal(detail) });
      return () => renderCollageCard({ name: trip.name, caption, photos: collagePhotos(candidates, selection, SEED), style });
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
  }, [detail, ready, empty, feedFailed, isCollage, candidates, selection, thumbhashes, style]);

  const version = `${tripId}:${kind}:${isCollage ? selection.join(",") : ""}`;
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

  /** Invite only: copies the link (handy to paste as the Link sticker) and confirms with the native HUD. */
  async function copyLink() {
    if (!detail) return;
    setShareFailed(false);
    try {
      await Clipboard.setStringAsync(inviteLink(detail));
    } catch {
      setShareFailed(true);
      return;
    }
    Burnt.toast({ title: "Link copiado", preset: "done" });
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
  // The preview fills the space left over, at 9:16: its height is what's available (or less, if the width runs out first).
  const previewHeight = Math.max(0, Math.min(area.height, area.width / STORY_RATIO));
  const onPreviewArea = ({ nativeEvent: { layout } }: LayoutChangeEvent) => setArea({ width: layout.width, height: layout.height });

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      {/* A solid header (as in share-pick): every state starts below it instead of behind it. */}
      <Stack.Screen
        options={{ headerTransparent: false, headerStyle: { backgroundColor: colors.groupedBackground }, headerShadowVisible: false, headerBlurEffect: "none" }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>Cancelar</Stack.Toolbar.Button>
      </Stack.Toolbar>

      {!!detailError && <ErrorText>{detailError}</ErrorText>}
      {empty && <Footnote>Todavía no hay fotos para armar el collage.</Footnote>}
      {feedFailed && (
        <View style={styles.failure}>
          <ErrorText>{feedError}</ErrorText>
          <RetryPill onPress={() => void refetchFeed()} />
        </View>
      )}
      {assets.error && (
        <View style={styles.failure}>
          <ErrorText>No se pudo armar la imagen. Probá de nuevo.</ErrorText>
          <RetryPill onPress={assets.retry} />
        </View>
      )}
      {!detailError && !empty && !feedFailed && !assets.error && build === null && <Loading />}
      {build !== null && !assets.error && (
        <>
          <View style={styles.previewArea} onLayout={onPreviewArea}>
            <StoryPreview style={style} card={assets.card} height={previewHeight} />
          </View>
          {isCollage && (
            <CollageStrip
              photos={stripPhotos}
              token={token}
              onPress={candidates.length >= 2 ? () => router.push({ pathname: "/share-pick", params: { tripId, seed: String(SEED) } }) : null}
            />
          )}
          <StyleChips value={style} onChange={setStyle} />
          <SharePills
            instagram={instagram}
            whatsapp={whatsapp}
            disabled={!filesReady}
            onInstagram={() => void shareStories()}
            onWhatsApp={() => void share(() => shareImageToWhatsApp(assets.stillUri!), true)}
            onMore={() => void share((link) => shareMore(assets.stillUri!, link), true)}
            onCopyLink={isCollage ? undefined : () => void copyLink()}
          />
          {!isCollage && (
            <Text style={[type.caption, styles.hint]}>Copiamos el link. Pegalo en tu story con el sticker de Enlace</Text>
          )}
          {shareFailed && <ErrorText>No se pudo compartir. Probá de nuevo.</ErrorText>}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.md },
  failure: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  previewArea: { flex: 1, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  hint: { color: colors.secondaryLabel, textAlign: "center" },
});
