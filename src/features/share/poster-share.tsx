// The "Afiche" half of Compartir: the still poster of the route, its preview and the destinations. Mounted only while its segment is selected.
import { Image } from "expo-image";
import { type ReactNode, useMemo, useState } from "react";
import { ActivityIndicator, type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { localDay } from "@/features/capture/quota";
import { filmBlocked, filmPhotos, filmStopCount } from "@/features/journey/film-photos";
import { usePoster } from "@/features/journey/poster/use-poster";
import type { RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";
import { ErrorText, Footnote } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { RetryPill } from "./retry-pill";
import { SharePills } from "./share-pills";
import { isShareCancel, shareImageToInstagramStories, shareImageToWhatsApp, shareMore } from "./share-story";
import { STORY_RATIO } from "./story-preview";

/** The poster body of Compartir. It uses the photos the Recorrido uses (`selection`); it has no picker of its own. */
export function PosterShare({
  tripId,
  detail,
  candidates,
  selection,
  token,
  instagram,
  whatsapp,
  accessory,
}: {
  tripId: string;
  detail: TripDetail;
  /** `filmCandidates` of the roll. */
  candidates: RevealedPhoto[];
  /** The Recorrido's selection. */
  selection: readonly string[];
  token: string | null;
  instagram: boolean;
  whatsapp: boolean;
  /** Rendered right under the preview (the Video | Afiche control). */
  accessory?: ReactNode;
}) {
  const chosen = useMemo(() => filmPhotos(candidates, selection), [candidates, selection]);
  const { startsAt, timezone } = detail.trip;
  const stops = useMemo(() => filmStopCount(chosen, localDay(startsAt, timezone)), [chosen, startsAt, timezone]);
  const blocked = filmBlocked(detail, stops);
  const poster = usePoster({ tripId, photos: chosen, token, detail, enabled: blocked === null });
  const noRoute = blocked === "no-route" || poster.status === "no-route";

  const [area, setArea] = useState({ width: 0, height: 0 });
  const [shareFailed, setShareFailed] = useState(false);
  const onLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) => setArea({ width: layout.width, height: layout.height });
  const previewHeight = Math.max(0, Math.min(area.height, area.width / STORY_RATIO));
  const box = { height: previewHeight, width: previewHeight * STORY_RATIO };

  async function share(send: (uri: string) => Promise<void>) {
    if (poster.status !== "ready") return;
    setShareFailed(false);
    try {
      await send(poster.uri);
    } catch (e) {
      if (!isShareCancel(e)) setShareFailed(true);
    }
  }

  return (
    <>
      <View style={styles.previewArea} onLayout={onLayout}>
        {poster.status === "ready" && !noRoute ? (
          <Image
            source={{ uri: poster.uri }}
            cachePolicy="none"
            contentFit="cover"
            accessibilityLabel="Vista previa del afiche"
            style={[box, styles.image]}
          />
        ) : (
          <View style={[styles.placeholder, box]}>
            {poster.status === "loading" && !noRoute && (
              <>
                <ActivityIndicator accessibilityLabel="Armando el afiche" />
                <Text style={[type.footnote, styles.loadingText]}>Armando el afiche…</Text>
              </>
            )}
          </View>
        )}
      </View>
      {accessory}
      {noRoute && <Footnote>Con estas fotos no hay recorrido: elegí fotos de al menos dos lugares.</Footnote>}
      {!noRoute && poster.status === "error" && (
        <View style={styles.failure}>
          <ErrorText>{poster.offline ? "Para armar el afiche hace falta conexión." : "No se pudo armar el afiche. Probá de nuevo."}</ErrorText>
          <RetryPill onPress={poster.retry} />
        </View>
      )}
      {!noRoute && poster.status === "ready" && (
        <>
          <SharePills
            instagram={instagram}
            whatsapp={whatsapp}
            disabled={false}
            onInstagram={() => void share(shareImageToInstagramStories)}
            onWhatsApp={() => void share(shareImageToWhatsApp)}
            onMore={() => void share((uri) => shareMore(uri))}
          />
          {shareFailed && <ErrorText>No se pudo compartir. Probá de nuevo.</ErrorText>}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  previewArea: { flex: 1, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  image: { borderRadius: 12 },
  placeholder: { alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: 12, backgroundColor: colors.latent },
  loadingText: { color: colors.secondaryLabel },
  failure: { alignItems: "center", gap: spacing.md },
});
