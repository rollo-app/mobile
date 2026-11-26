import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { memo, useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { mediaSource } from "@/features/media/revealed";
import { coverUri } from "@/features/trips/cover-uri";
import { colors, radius, spacing, type } from "@/ui/theme";
import { bannerPhoto, type RollVideoKind } from "./roll-videos";
import { useTripRollVideos } from "./use-roll-videos";

const KIND_LABEL: Record<RollVideoKind, string> = { route: "Recorrido", sheet: "Resumen" };
const SCRIM = "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 100%)";
const BUTTON = 36;

/**
 * "El video de tu rollo": a card for the top of the gallery with the roll's own picture behind it, play and share. It decides by
 * itself whether the roll has a video (nothing at all until it knows) and never builds one: play opens `/roll-video`, share opens Compartir.
 */
export const RollVideoBanner = memo(function RollVideoBanner({ tripId }: { tripId: string }) {
  const router = useRouter();
  const { kinds, photos, token, detail } = useTripRollVideos(tripId);
  const kind = kinds[0];
  const cover = coverUri(detail?.trip.coverUrl);
  const photo = useMemo(() => (cover ? null : bannerPhoto(photos)), [cover, photos]);
  const source = useMemo(() => {
    if (cover) return { uri: cover };
    return photo && token ? mediaSource(photo.thumbPath, token) : null;
  }, [cover, photo, token]);

  const play = useCallback(() => {
    if (kind) router.push({ pathname: "/roll-video", params: { tripId, kind } });
  }, [router, tripId, kind]);
  const share = useCallback(() => {
    if (kind) router.push({ pathname: "/share-story", params: { tripId, kind: kind === "route" ? "journey" : "sheet" } });
  }, [router, tripId, kind]);

  if (!kind) return null;
  return (
    <Pressable testID="roll-video-banner" accessible={false} onPress={play} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {!!source && (
        <Image
          testID="roll-video-banner-image"
          source={source}
          placeholder={photo?.thumbhash ? { thumbhash: photo.thumbhash } : undefined}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
          accessibilityIgnoresInvertColors
        />
      )}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim]} />
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={[type.headline, styles.title]} numberOfLines={1}>El video de tu rollo</Text>
          <Text style={[type.footnote, styles.kind]} numberOfLines={1}>{kinds.map((k) => KIND_LABEL[k]).join(" · ")}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Compartir el video" hitSlop={4} onPress={share} style={[styles.button, styles.shareButton]}>
          <SymbolView name="square.and.arrow.up" size={16} weight="semibold" tintColor="#FFFFFF" />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Ver el video" hitSlop={4} onPress={play} style={[styles.button, styles.playButton]}>
          <SymbolView name="play.fill" size={15} tintColor={colors.onTint as string} />
        </Pressable>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    height: 110,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderCurve: "continuous",
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: colors.latent,
  },
  pressed: { opacity: 0.92 },
  scrim: { backgroundImage: SCRIM },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  text: { flex: 1, gap: 2 },
  title: { color: "#FFFFFF" },
  kind: { color: "rgba(255,255,255,0.85)" },
  button: { width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2, alignItems: "center", justifyContent: "center" },
  shareButton: { backgroundColor: "rgba(255,255,255,0.28)" },
  playButton: { backgroundColor: colors.tint },
});
