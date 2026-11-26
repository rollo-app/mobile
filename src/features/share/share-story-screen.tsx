import * as Burnt from "burnt";
import * as Clipboard from "expo-clipboard";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { localDay } from "@/features/capture/quota";
import { filmBlocked, filmCandidates, filmStopCount } from "@/features/journey/film-photos";
import { sheetBlocked, sheetCandidates, sheetPick } from "@/features/journey/sheet/sheet-photos";
import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { useRevealedPhotos } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";
import { memberTotal } from "@/features/trips/member-total";
import { useFeed } from "@/features/trips/use-feed";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { ErrorText, Footnote, Loading } from "@/ui/components";
import { videoAvailable } from "../../../modules/rollo-video";
import { colors, spacing, tintHex, type } from "@/ui/theme";
import { collageCandidates, collageCaption } from "./collage";
import { collagePhotos, useCollageSelection } from "./collage-selection";
import { useFilmSelection } from "./film-selection";
import { FilmShare } from "./journey-share";
import { useSheetChoices } from "./sheet-selection";
import { canShareInvite, inviteCaption, inviteLink, inviteSwatches, whatsAppInviteMessage } from "./invite";
import { renderCollageCard } from "./render-collage";
import { assetUri } from "./asset-uri";
import { renderInviteCard } from "./render-invite";
import { instagramStoriesAvailable, isShareCancel, shareImageToWhatsApp, shareMore, shareTextToWhatsApp, shareToInstagramStories, whatsAppAvailable } from "./share-story";
import { CollageStrip } from "./collage-strip";
import { SharePills } from "./share-pills";
import { StyleChips } from "./style-chips";
import { StoryPreview, STORY_RATIO } from "./story-preview";
import { DEFAULT_STYLE, STYLE_ASSETS, STYLE_PALETTE } from "./story-style";
import { useStoryAssets } from "./use-story-assets";
import { RetryPill } from "./retry-pill";

/** Fixed seed: with no selection, the collage is always the same random pick. */
const SEED = 1;

type ShareMode = "collage" | "film";

/** Why this roll has nothing to share as `kind`, or null if it can be shared. */
function blockedReason(detail: TripDetail, kind: "collage" | "invite"): string | null {
  if (kind === "collage") return detail.trip.featuringDisabled ? "Este rollo es privado: sus fotos no se comparten fuera del rollo." : null;
  if (canShareInvite(detail)) return null;
  return detail.trip.revealed ? "Este rollo ya se reveló: ya no se puede invitar a más gente." : "Este rollo está lleno: no se puede invitar a más gente.";
}

/** "Compartir": builds the Stories image (collage or invitation), previews it and offers Instagram Stories, the system sheet and, for the collage, choosing the photos. */
export function ShareStoryScreen({ tripId, kind }: { tripId: string; kind: "collage" | "invite" | "journey" }) {
  const { detail, error: detailError } = useTripDetail(tripId);
  const { photos, token, complete, loadAll } = useRevealedPhotos(tripId);
  const { feed, loading: feedLoading, error: feedError, refetch: refetchFeed } = useFeed(tripId, { mode: "all" });
  const selection = useCollageSelection(tripId);
  const filmSelection = useFilmSelection(tripId);
  const sheetChoices = useSheetChoices(tripId);
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const [mode, setMode] = useState<ShareMode>(kind === "journey" ? "film" : "collage");
  // Drawn once per visit: the preview and the exported video of one visit always match, and nothing changes it.
  const [filmSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff) + 1);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [loadedAll, setLoadedAll] = useState(false);
  const [instagram, setInstagram] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const insets = useSafeAreaInsets();
  const [area, setArea] = useState({ width: 0, height: 0 });
  // The collage tab and the film tab both pick from the whole roll; only the invitation is its own thing.
  const isCollage = kind !== "invite";

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

  // The list offers Compartir on every roll without knowing these: say why there's nothing to share instead of drawing a card.
  const blocked = detail === null ? null : blockedReason(detail, isCollage ? "collage" : "invite");
  const ready = detail !== null && !blocked && (isCollage ? complete || loadedAll : !feedLoading);
  // No photos because the feed failed to load is an error with a retry, not "no photos".
  const feedFailed = isCollage && !!feedError;
  const empty = isCollage && ready && candidates.length === 0 && !feedFailed;
  const filmPool = useMemo(() => filmCandidates(photos), [photos]);
  // Recorrido is offered only where the roll has a film (a route of at least two stops) and the build has the video module.
  const startsAt = detail?.trip.startsAt;
  const timezone = detail?.trip.timezone;
  // buildStops over every candidate is not free: only when the candidates or the first day change.
  const poolStops = useMemo(
    () => (startsAt === undefined || timezone === undefined ? 0 : filmStopCount(filmPool, localDay(startsAt, timezone))),
    [filmPool, startsAt, timezone],
  );
  const canFilm = isCollage && videoAvailable && ready && !empty && !feedFailed && detail !== null && filmBlocked(detail, poolStops) === null;
  // The summary film is the second piece only where there is no route.
  const sheetPhotos = useMemo(() => sheetCandidates(photos), [photos]);
  const sheet = useMemo(() => sheetPick(sheetPhotos, sheetChoices), [sheetPhotos, sheetChoices]);
  const canSheet =
    !canFilm && isCollage && videoAvailable && ready && !empty && !feedFailed && detail !== null && sheetBlocked(detail, sheet.cells.length) === null;
  const secondKind = canFilm ? "route" : canSheet ? "sheet" : null;
  const journeyOn = mode === "film" && secondKind !== null;
  const stripPhotos = useMemo(() => (isCollage ? collagePhotos(candidates, selection, SEED) : []), [isCollage, candidates, selection]);
  const build = useMemo(() => {
    if (!detail || !ready || empty || feedFailed || journeyOn) return null;
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
  }, [detail, ready, empty, feedFailed, journeyOn, isCollage, candidates, selection, thumbhashes, style]);

  const version = `${tripId}:${isCollage ? "collage" : "invite"}:${isCollage ? selection.join(",") : ""}`;
  const assets = useStoryAssets(build, version, isCollage ? "collage" : "invite", style);

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
      {!!blocked && <Footnote>{blocked}</Footnote>}
      {empty && <Footnote>Todavía no hay fotos para armar el collage.</Footnote>}
      {feedFailed && (
        <View style={styles.failure}>
          <ErrorText>{feedError}</ErrorText>
          <RetryPill onPress={() => void refetchFeed()} />
        </View>
      )}
      {!journeyOn && assets.error && (
        <View style={styles.failure}>
          <ErrorText>No se pudo armar la imagen. Probá de nuevo.</ErrorText>
          <RetryPill onPress={assets.retry} />
        </View>
      )}
      {secondKind !== null && (
        <SegmentedControl
          values={["Collage", secondKind === "route" ? "Recorrido" : "Resumen"]}
          tintColor={tintHex[scheme]}
          selectedIndex={journeyOn ? 1 : 0}
          onValueChange={(v) => setMode(v === "Collage" ? "collage" : "film")}
        />
      )}
      {journeyOn && detail !== null && secondKind === "route" && (
        <FilmShare kind="route" tripId={tripId} detail={detail} candidates={filmPool} selection={filmSelection} token={token} seed={filmSeed} instagram={instagram} />
      )}
      {journeyOn && detail !== null && secondKind === "sheet" && (
        <FilmShare kind="sheet" tripId={tripId} detail={detail} pick={sheet} token={token} seed={filmSeed} instagram={instagram} />
      )}
      {!journeyOn && !detailError && !blocked && !empty && !feedFailed && !assets.error && build === null && <Loading />}
      {!journeyOn && build !== null && !assets.error && (
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
            // The invitation goes as text with the join link: WhatsApp draws the link's preview (the site's card for this roll).
            onWhatsApp={() =>
              void share(() => (isCollage ? shareImageToWhatsApp(assets.stillUri!) : shareTextToWhatsApp(whatsAppInviteMessage(detail!))), false)
            }
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
