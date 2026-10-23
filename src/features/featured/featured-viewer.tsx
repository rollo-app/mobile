import { MenuView } from "@expo/ui/community/menu";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMe } from "@/features/auth/use-me";
import { LikeButton } from "@/features/likes/like-button";
import { useDoubleTap } from "@/features/likes/use-double-tap";
import { useToggleLike } from "@/features/likes/use-toggle-like";
import { mediaSource, useMediaToken } from "@/features/media/revealed";
import { useReport } from "@/features/moderation/use-report";
import { Avatar } from "@/features/profile/avatar";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { OverlayCornerSymbol, OverlayIconButton, OverlayMoreButton, overlayCorner } from "@/ui/overlay-button";
import { spacing, type } from "@/ui/theme";
import { unfeatureMedia, type FeaturedPhoto } from "./actions";
import { featuredLabel } from "./featured-grid";
import { featuredKey, useFeatured } from "./use-featured";

function Page({
  photo,
  token,
  width,
  height,
  onTap,
  onDoubleTap,
}: {
  photo: FeaturedPhoto;
  token: string;
  width: number;
  height: number;
  onTap: () => void;
  /** A double tap likes it (the heart below fills). */
  onDoubleTap: (photo: FeaturedPhoto) => void;
}) {
  const taps = useDoubleTap(onTap, () => onDoubleTap(photo));
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
      <Pressable accessibilityLabel={featuredLabel(photo)} onPress={() => taps.tap()} style={{ width, height }}>
        <Image
          source={mediaSource(photo.originalPath, token)}
          placeholder={mediaSource(photo.thumbPath, token)}
          transition={150}
          contentFit="contain"
          style={{ width, height }}
        />
      </Pressable>
    </ScrollView>
  );
}

/**
 * Full-screen pager over someone's featured photos, starting at `mediaId`. It shows who took each one
 * when it isn't the profile's owner, and never the roll or the caption. On your own profile it can take
 * the photo off it. Tap hides or shows the overlay; double tap likes the photo.
 */
export function FeaturedViewer({ userId, mediaId }: { userId: string; mediaId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const queryClient = useQueryClient();
  const { me } = useMe();
  const openProfile = useOpenProfile();
  const own = !!me && me.id === userId;
  const { photos: loaded, loading } = useFeatured(userId);
  const photos = loaded ?? [];
  const token = useMediaToken(userId);
  const likes = useToggleLike();
  const likeTarget = (target: FeaturedPhoto) => ({ id: target.mediaId, likedByMe: target.likedByMe });

  const startIndex = useRef<number | null>(null);
  if (startIndex.current === null && photos.length > 0) startIndex.current = Math.max(0, photos.findIndex((p) => p.mediaId === mediaId));
  const [index, setIndex] = useState<number | null>(null);
  const current = index ?? startIndex.current ?? 0;
  const photo = photos[current];

  const [chrome, setChrome] = useState(true);
  const toggle = useCallback(() => setChrome((v) => !v), []);

  // Guards against a second tap before `removing` re-renders the button as busy.
  const removeInFlight = useRef(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<{ mediaId: string; message: string } | null>(null);

  async function remove(target: FeaturedPhoto) {
    if (removeInFlight.current) return;
    removeInFlight.current = true;
    setRemoving(true);
    setRemoveError(null);
    try {
      await unfeatureMedia(target.mediaId);
    } catch (e) {
      setRemoveError({ mediaId: target.mediaId, message: e instanceof Error ? e.message : "No se pudo sacar de tu perfil" });
      return;
    } finally {
      removeInFlight.current = false;
      setRemoving(false);
    }
    queryClient.setQueryData<FeaturedPhoto[]>(featuredKey(userId), (list) => list?.filter((p) => p.mediaId !== target.mediaId));
    // The roll galleries mark the photo as featured: they refetch.
    void queryClient.invalidateQueries({ queryKey: ["feed"] });
    router.back();
  }

  const report = useReport();
  // The photo's author (the profile's owner when nobody is named): you can't report your own.
  const reportable = !!photo && !!me && (photo.author?.id ?? userId) !== me.id;

  async function reportPhoto(target: FeaturedPhoto) {
    if (report.busy || !(await report.reportMedia({ mediaId: target.mediaId }))) return;
    queryClient.setQueryData<FeaturedPhoto[]>(featuredKey(userId), (list) => list?.filter((p) => p.mediaId !== target.mediaId));
    // Moves on to the next photo (the list shrank under the same index); the last one closes the viewer.
    if (current >= photos.length - 1) router.back();
  }

  const error = photo && removeError?.mediaId === photo.mediaId ? removeError.message : null;
  const likeError = photo && likes.error?.mediaId === photo.mediaId ? likes.error.message : null;

  return (
    <View testID="featured-viewer" style={styles.fill}>
      <StatusBar style="light" />
      {token && photos.length > 0 && startIndex.current !== null ? (
        <FlatList
          testID="featured-pager"
          data={photos}
          keyExtractor={(p) => p.mediaId}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex.current}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          windowSize={3}
          initialNumToRender={1}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <Page
              photo={item}
              token={token}
              width={width}
              height={height}
              onTap={toggle}
              onDoubleTap={(target) => void likes.like(likeTarget(target))}
            />
          )}
        />
      ) : (
        loading && <ActivityIndicator color="#FFFFFF" style={styles.fill} />
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
          {photo && reportable && (
            // In the corner opposite the ✕.
            <View style={[styles.more, { top: insets.top + spacing.sm }]}>
              <MenuView
                actions={[{ id: "report", title: "Denunciar", image: "exclamationmark.bubble" }]}
                onPressAction={() => void reportPhoto(photo)}
              >
                <OverlayMoreButton />
              </MenuView>
            </View>
          )}
          {photo && (
            <View testID="featured-info" pointerEvents="box-none" style={[styles.info, { paddingBottom: insets.bottom + spacing.sm }]}>
              {photo.author && (
                // Closes the viewer and opens the author's profile over the tabs (or Perfil if it's you).
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Perfil de ${photo.author.name}`}
                  onPress={() => photo.author && openProfile(photo.author.id, { leave: true })}
                  style={({ pressed }) => [styles.authorRow, pressed && styles.pressed]}
                >
                  <Avatar id={photo.author.id} name={photo.author.name} avatarUrl={photo.author.avatarUrl} size={40} />
                  <Text style={[type.headline, styles.white]}>{photo.author.name}</Text>
                </Pressable>
              )}
              <View style={styles.actions}>
                <LikeButton
                  liked={photo.likedByMe}
                  count={photo.likeCount}
                  busy={likes.pending.has(photo.mediaId)}
                  onPress={() => void likes.toggle(likeTarget(photo))}
                />
                {own && (
                  <OverlayIconButton
                    symbol="star.slash"
                    label="Sacar de tu perfil"
                    busy={removing}
                    onPress={() => void remove(photo)}
                  />
                )}
              </View>
              {likeError && <Text style={[type.footnote, styles.dim]}>{likeError}</Text>}
              {error && <Text style={[type.footnote, styles.dim]}>{error}</Text>}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000000" },
  close: { position: "absolute", left: spacing.md },
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
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start" },
  pressed: { opacity: 0.6 },
  white: { color: "#FFFFFF" },
  dim: { color: "rgba(255,255,255,0.7)" },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
});
