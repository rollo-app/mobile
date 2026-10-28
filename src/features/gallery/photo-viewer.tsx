import { MenuView } from "@expo/ui/community/menu";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMe } from "@/features/auth/use-me";
import { useBlockFeature } from "@/features/featured/use-block-feature";
import { useToggleFeatured } from "@/features/featured/use-toggle-featured";
import { useToggleLike } from "@/features/likes/use-toggle-like";
import { MomentBadge } from "@/features/media/moment-badge";
import { SelfieInset } from "@/features/media/selfie-inset";
import { useRevealedPhotos } from "@/features/media/revealed";
import { useReport } from "@/features/moderation/use-report";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { OverlayCornerSymbol, OverlayMoreButton, overlayCorner } from "@/ui/overlay-button";
import { spacing, type } from "@/ui/theme";
import { useArchivePhoto } from "./use-archive-photo";
import { useDeletePhoto } from "./use-delete-photo";
import { useOpenCommentsOnce } from "./use-open-comments-once";
import { savedTarget, useSavePhoto } from "./use-save-photo";
import { useSaver } from "./use-saver";
import { useViewerStart } from "./use-viewer-start";
import { ViewerInfo } from "./viewer-info";
import { viewerMenu } from "./viewer-menu";
import { ViewerPage } from "./viewer-page";

/** Full-screen pager over the roll's photos, starting at `id`. Tap hides or shows the overlay; double tap likes a photo. */
export function PhotoViewer({
  id,
  tripId: tripParam,
  openComments,
}: {
  id: string;
  tripId?: string;
  /** Coming from a comment push: open the comments sheet on `id` once it has loaded. */
  openComments?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { trip } = useActiveTrip();
  const tripId = tripParam ?? trip?.id;
  const { photos, token, loading, refetch } = useRevealedPhotos(tripId);
  const { detail } = useTripDetail(tripId);
  const saver = useSaver(token, detail?.trip.name, detail?.trip.timezone);
  const { me } = useMe();
  const featured = useToggleFeatured();
  const blocker = useBlockFeature();
  const likes = useToggleLike();
  // Which photo the last feature/block attempt was for, so its error shows only on that page.
  const [featureTarget, setFeatureTarget] = useState<string | null>(null);

  const { startIndex, missing, notFound } = useViewerStart(photos, id, tripId, loading, refetch);
  const [index, setIndex] = useState<number | null>(null);
  const current = index ?? startIndex ?? 0;
  const photo = missing ? undefined : photos[current];
  useOpenCommentsOnce(photos, id, openComments);

  // Photos whose moment selfie is the big picture now; the actions below always act on the main photo.
  const [selfieBig, setSelfieBig] = useState<Record<string, boolean>>({});
  const [chrome, setChrome] = useState(true);
  const { saves, save } = useSavePhoto(saver);
  const toggle = useCallback(() => setChrome((v) => !v), []);

  function toggleFeatured(target: { id: string; featuredByMe: boolean }) {
    if (!tripId) return;
    setFeatureTarget(target.id);
    blocker.reset();
    void featured.toggle(target, tripId);
  }

  function setBlocked(target: { id: string }, blocked: boolean) {
    if (!tripId || blocker.blocking) return;
    setFeatureTarget(target.id);
    void blocker.setBlocked(target.id, tripId, blocked);
  }

  const report = useReport();
  async function reportPhoto(target: { id: string }) {
    if (report.busy || !(await report.reportMedia({ mediaId: target.id, tripId }))) return;
    // The photo left the feed cache: the list shrank under the same index, so the next one is showing. The last one closes.
    if (current >= photos.length - 1) router.back();
  }

  const setArchived = useArchivePhoto();
  const remover = useDeletePhoto();
  async function deletePhoto(target: Parameters<typeof remover.confirmDelete>[0]) {
    if (!tripId || remover.busy || !(await remover.confirmDelete(target, tripId))) return;
    // Same as reporting: the next photo slides in under the same index, and deleting the last one closes.
    if (current >= photos.length - 1) router.back();
  }

  const saveState = (photo && saves[savedTarget(photo, !!selfieBig[photo.id]).id]) || "idle";
  const featureError = photo && featureTarget === photo.id ? (blocker.error ?? featured.error) : null;
  const likeError = photo && likes.error?.mediaId === photo.id ? likes.error.message : null;
  // Before the reveal only daily moments have files: you can look at them, comment on them and report them, nothing else
  // (likes, saving and featuring wait for the reveal; the server rejects them).
  const readOnly = !!photo?.momentDay && detail?.trip.revealed !== true;
  const menu = viewerMenu({ photo, meId: me?.id, revealed: detail?.trip.revealed === true, blocking: blocker.blocking });

  return (
    <View style={styles.fill}>
      <StatusBar style="light" />
      {token && photos.length > 0 && startIndex !== null ? (
        <FlatList
          testID="viewer-pager"
          data={photos}
          keyExtractor={(p) => p.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          windowSize={3}
          initialNumToRender={1}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => (
            <ViewerPage
              photo={item}
              token={token}
              active={i === current}
              selfieBig={!!selfieBig[item.id]}
              width={width}
              height={height}
              onTap={toggle}
              onDoubleTap={(target) => !readOnly && void likes.like(target)}
            />
          )}
        />
      ) : (
        notFound ? (
          <View style={styles.notFound}>
            <Text style={[type.body, styles.dim]}>No encontramos esta foto.</Text>
          </View>
        ) : (
          <ActivityIndicator color="#FFFFFF" style={styles.fill} />
        )
      )}

      {chrome && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={() => router.back()}
            style={[overlayCorner, styles.close, { top: insets.top + spacing.sm }]}
          >
            <OverlayCornerSymbol name="xmark" />
          </Pressable>
          {photo?.selfie && token ? (
            <SelfieInset
              photo={photo}
              token={token}
              selfieBig={!!selfieBig[photo.id]}
              onToggle={() => setSelfieBig((s) => ({ ...s, [photo.id]: !s[photo.id] }))}
              style={[styles.moment, { top: insets.top + spacing.sm + 36 + spacing.sm }]}
            />
          ) : photo?.momentDay ? (
            <MomentBadge style={[styles.moment, { top: insets.top + spacing.sm + 36 + spacing.sm }]} />
          ) : null}
          {photo && menu.length > 0 && (
            // The author's and moderation options, in the corner opposite the ✕.
            <View style={[styles.more, { top: insets.top + spacing.sm }]}>
              <MenuView
                actions={menu}
                onPressAction={({ nativeEvent }) => {
                  const event = nativeEvent.event;
                  if (event === "report") void reportPhoto(photo);
                  else if (event === "archive" || event === "unarchive") tripId && setArchived(photo, tripId, event === "archive");
                  else if (event === "delete") void deletePhoto(photo);
                  else setBlocked(photo, event === "block");
                }}
              >
                <OverlayMoreButton />
              </MenuView>
            </View>
          )}
          {photo && (
            <ViewerInfo
              photo={photo}
              timeZone={detail?.trip.timezone ?? "America/Argentina/Buenos_Aires"}
              bottomInset={insets.bottom}
              readOnly={readOnly}
              liking={likes.pending.has(photo.id)}
              featuring={featured.pending.has(photo.id)}
              saveState={saveState}
              canSave={!!saver}
              likeError={likeError}
              featureError={featureError}
              onLike={() => void likes.toggle(photo)}
              onToggleFeatured={() => toggleFeatured(photo)}
              onSave={() => void save(savedTarget(photo, !!selfieBig[photo.id]))}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000000" },
  notFound: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  close: { position: "absolute", left: spacing.md },
  moment: { position: "absolute", left: spacing.md },
  more: { position: "absolute", right: spacing.md },
  dim: { color: "rgba(255,255,255,0.7)" },
});
