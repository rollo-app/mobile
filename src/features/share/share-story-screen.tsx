import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useRevealedPhotos } from "@/features/media/revealed";
import { memberTotal } from "@/features/trips/member-total";
import { useFeed } from "@/features/trips/use-feed";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Footnote, Loading, Screen } from "@/ui/components";
import { colors, radius, spacing, type } from "@/ui/theme";
import { canShuffle, collageCandidates, collageCaption, nextSeed, pickCollage } from "./collage";
import { inviteCaption, inviteLink, inviteSwatches } from "./invite";
import { renderCollage } from "./render-collage";
import { renderInvite } from "./render-invite";
import { instagramStoriesAvailable, isShareCancel, shareMore, shareToInstagramStories } from "./share-story";
import { useStoryImage } from "./use-story-image";

const STORY_RATIO = 9 / 16;
/** The preview never takes more than this share of the screen's height. */
const MAX_PREVIEW_HEIGHT = 0.62;

/** "Compartir": builds the Stories image (collage or invitation), previews it and offers Instagram Stories, the system sheet and, for the collage, another pick. */
export function ShareStoryScreen({ tripId, kind }: { tripId: string; kind: "collage" | "invite" }) {
  const { detail, error: detailError } = useTripDetail(tripId);
  const { photos, complete, loadAll } = useRevealedPhotos(tripId);
  const { feed, loading: feedLoading } = useFeed(tripId, { mode: "all" });
  const [seed, setSeed] = useState(1);
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
    void loadAll().finally(() => setLoadedAll(true));
  }, [isCollage, feedLoading, complete, loadAll]);

  const candidates = useMemo(() => collageCandidates(photos), [photos]);
  const thumbhashes = useMemo(() => feed?.items.map((i) => i.thumbhash) ?? [], [feed]);

  const ready = detail !== null && (isCollage ? complete || loadedAll : !feedLoading);
  const empty = isCollage && ready && candidates.length === 0;
  const build = useMemo(() => {
    if (!detail || !ready || empty) return null;
    const { trip } = detail;
    if (isCollage) {
      const caption = collageCaption({ startsAt: trip.startsAt, endsAt: trip.endsAt, timeZone: trip.timezone, people: memberTotal(detail) });
      return () => renderCollage({ name: trip.name, caption, photos: pickCollage(candidates, seed) });
    }
    return () =>
      renderInvite({ name: trip.name, caption: inviteCaption(detail), code: trip.joinCode, coverUrl: trip.coverUrl ?? null, swatches: inviteSwatches(thumbhashes) });
  }, [detail, ready, empty, isCollage, candidates, seed, thumbhashes]);

  const image = useStoryImage(build, `${tripId}:${kind}:${isCollage ? seed : 0}`, kind);

  async function share(send: (uri: string, link: string | undefined) => Promise<void>) {
    if (!image.uri || !detail) return;
    setShareFailed(false);
    try {
      // The invitation has no link inside the image: it travels in the clipboard (and as the system sheet's message).
      const link = isCollage ? undefined : inviteLink(detail);
      if (link) await Clipboard.setStringAsync(link);
      await send(image.uri, link);
    } catch (e) {
      if (!isShareCancel(e)) setShareFailed(true);
    }
  }

  const previewHeight = Math.min((width - spacing.md * 2) / STORY_RATIO, height * MAX_PREVIEW_HEIGHT);

  return (
    <Screen grouped>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>Cancelar</Stack.Toolbar.Button>
      </Stack.Toolbar>

      {!!detailError && <ErrorText>{detailError}</ErrorText>}
      {empty && <Footnote>Todavía no hay fotos para armar el collage.</Footnote>}
      {image.error && (
        <>
          <ErrorText>No se pudo armar la imagen. Probá de nuevo.</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={image.retry} />
        </>
      )}
      {!detailError && !empty && !image.error && !image.uri && <Loading />}
      {image.uri !== null && (
        <>
          <View style={[styles.preview, { height: previewHeight }]}>
            <Image accessibilityLabel="Vista previa" source={{ uri: image.uri, cacheKey: `${tripId}:${kind}:${seed}` }} cachePolicy="none" contentFit="cover" style={styles.image} />
          </View>
          <View style={styles.actions}>
            {instagram && <Button label="Compartir en Stories" onPress={() => void share((uri) => shareToInstagramStories(uri))} />}
            <Button label="Más opciones" variant={instagram ? "secondary" : "primary"} onPress={() => void share((uri, link) => shareMore(uri, link))} />
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
  preview: { alignSelf: "center", aspectRatio: STORY_RATIO, borderRadius: radius.lg, borderCurve: "continuous", overflow: "hidden", backgroundColor: colors.fill },
  image: { flex: 1 },
  actions: { gap: spacing.sm },
  shuffle: { alignItems: "center", justifyContent: "center", minHeight: 44 },
});
