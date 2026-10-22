import { MenuView } from "@expo/ui/community/menu";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMe } from "@/features/auth/use-me";
import { blockFeature, unblockFeature } from "@/features/featured/actions";
import { useToggleFeatured } from "@/features/featured/use-toggle-featured";
import { Avatar } from "@/features/profile/avatar";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { formatPinTime } from "@/features/map/pin-time";
import { mediaSource, useRevealedPhotos, type RevealedPhoto } from "@/features/media/revealed";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { feedKey } from "@/features/trips/use-feed";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { spacing, tintHex, type } from "@/ui/theme";
import { PermissionNotice } from "./permission-notice";
import { PermissionDeniedError } from "./save";
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
  width,
  height,
  onTap,
}: {
  photo: RevealedPhoto;
  token: string;
  active: boolean;
  width: number;
  height: number;
  onTap: () => void;
}) {
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
      <Pressable accessibilityLabel={`Foto de ${photo.author.name}`} onPress={onTap} style={{ width, height }}>
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

/** Full-screen pager over the roll's photos, starting at `id`. Tap hides or shows the overlay. */
export function PhotoViewer({ id, tripId: tripParam }: { id: string; tripId?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { trip } = useActiveTrip();
  const tripId = tripParam ?? trip?.id;
  const { photos, token, loading } = useRevealedPhotos(tripId);
  const { detail } = useTripDetail(tripId);
  const saver = useSaver(token, detail?.trip.name, detail?.trip.timezone);
  const { me } = useMe();
  const openProfile = useOpenProfile();
  const queryClient = useQueryClient();
  const featured = useToggleFeatured();
  // Which photo the last feature/block attempt was for, so its error shows only on that page.
  const [featureTarget, setFeatureTarget] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  const startIndex = useRef<number | null>(null);
  if (startIndex.current === null && photos.length > 0) startIndex.current = Math.max(0, photos.findIndex((p) => p.id === id));
  const [index, setIndex] = useState<number | null>(null);
  const current = index ?? startIndex.current ?? 0;
  const photo = photos[current];

  const [chrome, setChrome] = useState(true);
  const [saves, setSaves] = useState<Record<string, SaveState>>({});
  const toggle = useCallback(() => setChrome((v) => !v), []);

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

  const state = (photo && saves[photo.id]) || "idle";
  const featuring = !!photo && featured.pending.has(photo.id);
  const featureError = photo && featureTarget === photo.id ? (blockError ?? featured.error) : null;
  const timeZone = detail?.trip.timezone ?? "America/Argentina/Buenos_Aires";

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
            <Page photo={item} token={token} active={i === current} width={width} height={height} onTap={toggle} />
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
            style={[styles.close, { top: insets.top + spacing.sm }]}
          >
            <SymbolView name="xmark" size={16} weight="semibold" tintColor="#FFFFFF" />
          </Pressable>
          {photo && (
            <View pointerEvents="box-none" style={[styles.info, { paddingBottom: insets.bottom + spacing.md }]}>
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
                {photo.lat !== null && photo.lng !== null && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ver en el mapa"
                    onPress={() => router.navigate({ pathname: "/map", params: { focus: photo.id } })}
                    style={styles.pill}
                  >
                    <SymbolView name="map" size={15} tintColor="#FFFFFF" />
                    <Text style={[type.subhead, styles.white]}>Ver en el mapa</Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={state === "saved" ? "Guardada" : "Guardar en Fotos"}
                  accessibilityState={{ disabled: state === "saving" || state === "saved" || !saver, busy: state === "saving" }}
                  disabled={state === "saving" || state === "saved" || !saver}
                  onPress={() => void save(photo)}
                  style={[styles.pill, state === "saved" && styles.pillDone]}
                >
                  {state === "saving" ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <SymbolView name={state === "saved" ? "checkmark" : "square.and.arrow.down"} size={15} tintColor="#FFFFFF" />
                  )}
                  <Text style={[type.subhead, styles.white]}>{state === "saved" ? "Guardada ✓" : "Guardar en Fotos"}</Text>
                </Pressable>
                {photo.type === "photo" && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={photo.featuredByMe ? "Destacada" : "Destacar"}
                    accessibilityState={{ selected: photo.featuredByMe, busy: featuring }}
                    disabled={featuring}
                    onPress={() => toggleFeatured(photo)}
                    style={styles.pill}
                  >
                    <SymbolView
                      name={photo.featuredByMe ? "star.fill" : "star"}
                      size={15}
                      // The viewer is always black: the dark-scheme cobalt reads on it whatever the system theme.
                      tintColor={photo.featuredByMe ? tintHex.dark : "#FFFFFF"}
                    />
                    <Text style={[type.subhead, styles.white]}>{photo.featuredByMe ? "Destacada" : "Destacar"}</Text>
                  </Pressable>
                )}
                {photo.type === "photo" && !!me && photo.authorUserId === me.id && (
                  <MenuView
                    actions={[
                      {
                        id: photo.featureBlocked ? "unblock" : "block",
                        title: photo.featureBlocked ? "Dejar que la destaquen" : "No dejar que la destaquen",
                        image: photo.featureBlocked ? "star" : "star.slash",
                        attributes: { disabled: blocking },
                      },
                    ]}
                    onPressAction={({ nativeEvent }) => void setBlocked(photo, nativeEvent.event === "block")}
                  >
                    <View accessibilityLabel="Más opciones" style={styles.pill}>
                      <SymbolView name="ellipsis" size={15} tintColor="#FFFFFF" />
                    </View>
                  </MenuView>
                )}
              </View>
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
  close: {
    position: "absolute",
    left: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
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
  actions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  pillDone: { backgroundColor: "rgba(255,255,255,0.1)" },
});
