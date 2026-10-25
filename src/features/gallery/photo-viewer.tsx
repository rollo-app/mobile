import { featureActionAvailable } from "@/features/featured/feature-action";
import { MenuView, type MenuAction } from "@expo/ui/community/menu";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMe } from "@/features/auth/use-me";
import { CommentButton } from "@/features/comments/comment-button";
import { blockFeature, unblockFeature } from "@/features/featured/actions";
import { useReport } from "@/features/moderation/use-report";
import { useToggleFeatured } from "@/features/featured/use-toggle-featured";
import { LikeButton } from "@/features/likes/like-button";
import { useDoubleTap } from "@/features/likes/use-double-tap";
import { useToggleLike } from "@/features/likes/use-toggle-like";
import { Avatar } from "@/features/profile/avatar";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { formatPinTime } from "@/features/map/pin-time";
import { MomentBadge } from "@/features/media/moment-badge";
import { SelfieInset } from "@/features/media/selfie-inset";
import { mediaSource, useRevealedPhotos, type RevealedPhoto } from "@/features/media/revealed";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { feedKey } from "@/features/trips/use-feed";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { OverlayCornerSymbol, OverlayIconButton, OverlayMoreButton, overlayCorner } from "@/ui/overlay-button";
import { spacing, tintHex, type } from "@/ui/theme";
import { PermissionNotice } from "./permission-notice";
import { PermissionDeniedError, linkedImage } from "./save";
import { useSaver } from "./use-saver";

type SaveState = "idle" | "saving" | "saved" | "failed" | "denied";

function VideoPage({ photo, token, active }: { photo: RevealedPhoto; token: string; active: boolean }) {
  const player = useVideoPlayer(mediaSource(photo.originalPath, token), (p) => {
    p.loop = true;
  });
  if (!active) return <Image source={mediaSource(photo.thumbPath, token)} contentFit="contain" style={StyleSheet.absoluteFill} />;
  return <VideoView player={player} nativeControls contentFit="contain" style={StyleSheet.absoluteFill} />;
}

function Page({
  photo,
  token,
  active,
  selfieBig,
  width,
  height,
  onTap,
  onDoubleTap,
}: {
  photo: RevealedPhoto;
  token: string;
  active: boolean;
  /** The moment's selfie is the big picture (likes still go to `photo`, the main one). */
  selfieBig: boolean;
  width: number;
  height: number;
  onTap: () => void;
  /** Photos only: a double tap likes it (the heart below fills). */
  onDoubleTap: (photo: RevealedPhoto) => void;
}) {
  const taps = useDoubleTap(onTap, () => onDoubleTap(photo));
  if (photo.type === "video") {
    return (
      <View style={{ width, height }}>
        <VideoPage photo={photo} token={token} active={active} />
      </View>
    );
  }
  return (
    <ScrollView
      style={{ width, height }}
      contentContainerStyle={{ width, height }}
      maximumZoomScale={4}
      minimumZoomScale={1}
      centerContent
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
    >
      <Pressable accessibilityLabel={`Foto de ${photo.author.name}`} onPress={() => taps.tap()} style={{ width, height }}>
        <Image
          source={mediaSource(selfieBig && photo.selfie ? photo.selfie.originalPath : photo.originalPath, token)}
          placeholder={mediaSource(selfieBig && photo.selfie ? photo.selfie.thumbPath : photo.thumbPath, token)}
          transition={150}
          contentFit="contain"
          style={{ width, height }}
        />
      </Pressable>
    </ScrollView>
  );
}

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
  const openProfile = useOpenProfile();
  const queryClient = useQueryClient();
  const featured = useToggleFeatured();
  const likes = useToggleLike();
  // Which photo the last feature/block attempt was for, so its error shows only on that page.
  const [featureTarget, setFeatureTarget] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  const startIndex = useRef<number | null>(null);
  // Locked only once the photo is found: a stale cached feed may not have it yet (a push for a new moment).
  if (startIndex.current === null) {
    const found = photos.findIndex((p) => p.id === id);
    if (found >= 0) startIndex.current = found;
  }
  // The photo is missing from what we have: ask the server once; if it is still missing, say so.
  const [missingChecked, setMissingChecked] = useState(false);
  const missing = startIndex.current === null;
  useEffect(() => {
    if (!missing || !tripId) return;
    let active = true;
    void refetch({ cancelRefetch: false }).finally(() => active && setMissingChecked(true));
    return () => {
      active = false;
    };
  }, [missing, tripId, refetch]);
  const notFound = missing && missingChecked && !loading;
  const [index, setIndex] = useState<number | null>(null);
  const current = index ?? startIndex.current ?? 0;
  const photo = missing ? undefined : photos[current];

  // The comments push opens the photo with its sheet, once.
  const commentsOpened = useRef(false);
  const sheetTarget = openComments && !commentsOpened.current ? photos.find((p) => p.id === id && p.type === "photo") : undefined;
  useEffect(() => {
    if (!sheetTarget) return;
    commentsOpened.current = true;
    router.push({ pathname: "/comments/[mediaId]", params: { mediaId: sheetTarget.id } });
  }, [sheetTarget, router]);

  // Photos whose moment selfie is the big picture now; the actions below always act on the main photo.
  const [selfieBig, setSelfieBig] = useState<Record<string, boolean>>({});
  const [chrome, setChrome] = useState(true);
  const [saves, setSaves] = useState<Record<string, SaveState>>({});
  const toggle = useCallback(() => setChrome((v) => !v), []);

  // "Guardar" saves the image that is big: the moment's linked one once it was swapped in.
  const savedTarget = (p: RevealedPhoto) => (selfieBig[p.id] && p.selfie ? linkedImage(p) : p);
  async function save(target: RevealedPhoto) {
    if (!saver) return;
    setSaves((s) => ({ ...s, [target.id]: "saving" }));
    try {
      await saver(target);
      setSaves((s) => ({ ...s, [target.id]: "saved" }));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setSaves((s) => ({ ...s, [target.id]: e instanceof PermissionDeniedError ? "denied" : "failed" }));
    }
  }

  function toggleFeatured(target: RevealedPhoto) {
    if (!tripId) return;
    setFeatureTarget(target.id);
    setBlockError(null);
    void featured.toggle(target, tripId);
  }

  async function setBlocked(target: RevealedPhoto, blocked: boolean) {
    if (!tripId || blocking) return;
    setFeatureTarget(target.id);
    setBlocking(true);
    setBlockError(null);
    try {
      await (blocked ? blockFeature : unblockFeature)(target.id);
      await queryClient.invalidateQueries({ queryKey: feedKey(tripId) });
    } catch (e) {
      setBlockError(e instanceof Error ? e.message : "No se pudo cambiar");
    } finally {
      setBlocking(false);
    }
  }

  const report = useReport();
  async function reportPhoto(target: RevealedPhoto) {
    if (report.busy || !(await report.reportMedia({ mediaId: target.id, tripId }))) return;
    // The photo left the feed cache: the list shrank under the same index, so the next one is showing. The last one closes.
    if (current >= photos.length - 1) router.back();
  }

  const state = (photo && saves[savedTarget(photo).id]) || "idle";
  const featuring = !!photo && featured.pending.has(photo.id);
  const featureError = photo && featureTarget === photo.id ? (blockError ?? featured.error) : null;
  const liking = !!photo && likes.pending.has(photo.id);
  const likeError = photo && likes.error?.mediaId === photo.id ? likes.error.message : null;
  const timeZone = detail?.trip.timezone ?? "America/Argentina/Buenos_Aires";
  // Someone else's photo can be reported; on your own photo you decide whether others may feature it.
  const own = !!photo && !!me && photo.authorUserId === me.id;
  // Before the reveal only daily moments have files: you can look at them (and report them), nothing else (the server rejects it).
  const readOnly = !!photo?.momentDay && detail?.trip.revealed !== true;
  const menu: MenuAction[] = !photo || !me
    ? []
    : !own
      ? [{ id: "report", title: "Denunciar", image: "exclamationmark.bubble" }]
      : photo.type === "photo" && !photo.momentDay // moment photos can never be featured
        ? [
            {
              id: photo.featureBlocked ? "unblock" : "block",
              title: photo.featureBlocked ? "Dejar que la destaquen" : "No dejar que la destaquen",
              image: photo.featureBlocked ? "star" : "star.slash",
              attributes: { disabled: blocking },
            },
          ]
        : [];

  return (
    <View style={styles.fill}>
      <StatusBar style="light" />
      {token && photos.length > 0 && startIndex.current !== null ? (
        <FlatList
          testID="viewer-pager"
          data={photos}
          keyExtractor={(p) => p.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex.current}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          windowSize={3}
          initialNumToRender={1}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => (
            <Page
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
                  if (nativeEvent.event === "report") void reportPhoto(photo);
                  else void setBlocked(photo, nativeEvent.event === "block");
                }}
              >
                <OverlayMoreButton />
              </MenuView>
            </View>
          )}
          {photo && (
            <View testID="viewer-info" pointerEvents="box-none" style={[styles.info, { paddingBottom: insets.bottom + spacing.sm }]}>
              <View style={styles.authorRow}>
                {/* Closes the viewer and opens the author's profile over the tabs (or Perfil if it's you). */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Perfil de ${photo.author.name}`}
                  onPress={() => openProfile(photo.authorUserId, { leave: true })}
                  style={({ pressed }) => [styles.authorRow, pressed && styles.pressed]}
                >
                  <Avatar id={photo.author.id} name={photo.author.name} avatarUrl={photo.author.avatarUrl} size={40} />
                  <Text style={[type.headline, styles.white]}>{photo.author.name}</Text>
                </Pressable>
                <Text style={[type.subhead, styles.dim]}>{formatPinTime(photo.takenAt, timeZone)}</Text>
              </View>
              {photo.caption ? <Text style={[type.quote, styles.white]}>{photo.caption}</Text> : null}
              <View style={styles.actions}>
                {photo.type === "photo" && !readOnly && (
                  <LikeButton liked={photo.likedByMe} count={photo.likeCount} busy={liking} onPress={() => void likes.toggle(photo)} />
                )}
                {photo.type === "photo" && !readOnly && (
                  <CommentButton
                    count={photo.commentCount}
                    onPress={() => router.push({ pathname: "/comments/[mediaId]", params: { mediaId: photo.id } })}
                  />
                )}
                {photo.type === "photo" && !readOnly && featureActionAvailable(photo) && (
                  <OverlayIconButton
                    symbol={photo.featuredByMe ? "person.crop.circle.badge.checkmark" : "person.crop.circle.badge.plus"}
                    symbolTestID="feature-symbol"
                    label={photo.featuredByMe ? "Sacar de tu perfil" : "Agregar a tu perfil"}
                    // Featured is a selection: cobalt (its dark-scheme value, since the viewer is always black).
                    tint={photo.featuredByMe ? tintHex.dark : "#FFFFFF"}
                    disabled={featuring}
                    onPress={() => toggleFeatured(photo)}
                  />
                )}
                {photo.lat !== null && photo.lng !== null && (
                  <OverlayIconButton
                    symbol="map"
                    label="Ver en el mapa"
                    onPress={() => router.navigate({ pathname: "/map", params: { focus: photo.id } })}
                  />
                )}
                {!readOnly && (
                  <OverlayIconButton
                    symbol={state === "saved" ? "checkmark" : "square.and.arrow.down"}
                    label={state === "saved" ? "Guardada" : "Guardar en Fotos"}
                    busy={state === "saving"}
                    disabled={state === "saved" || !saver}
                    onPress={() => void save(savedTarget(photo))}
                  />
                )}
              </View>
              {likeError && <Text style={[type.footnote, styles.dim]}>{likeError}</Text>}
              {featureError && <Text style={[type.footnote, styles.dim]}>{featureError}</Text>}
              {state === "failed" && <Text style={[type.footnote, styles.dim]}>No se pudo guardar. Probá de nuevo.</Text>}
              {state === "denied" && <PermissionNotice />}
            </View>
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
  info: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pressed: { opacity: 0.5 },
  white: { color: "#FFFFFF" },
  dim: { color: "rgba(255,255,255,0.7)" },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
});
