import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { memberColor } from "@/features/map/member-color";
import { mediaSource, type RevealedPhoto } from "@/features/media/revealed";
import { formatTime } from "@/features/trips/phase";
import { spacing, type } from "@/ui/theme";

/** What VoiceOver reads for a slide: who, when and the caption. */
export function slideLabel(photo: RevealedPhoto, timeZone: string) {
  const what = photo.type === "video" ? "Video" : "Foto";
  const base = `${what} de ${photo.author.name}, ${formatTime(photo.takenAt, timeZone)}`;
  return photo.caption ? `${base}. ${photo.caption}` : base;
}

/** A photo or video full screen over a blurred copy of itself, with author and caption below. */
export function Slide({
  photo,
  token,
  timeZone,
  paused,
  muted,
}: {
  photo: RevealedPhoto;
  token: string;
  timeZone: string;
  paused: boolean;
  muted: boolean;
}) {
  const placeholder = photo.thumbhash ? { thumbhash: photo.thumbhash } : undefined;
  return (
    <View style={styles.fill} accessible accessibilityLabel={slideLabel(photo, timeZone)}>
      <Image
        style={StyleSheet.absoluteFill}
        source={mediaSource(photo.thumbPath, token)}
        placeholder={placeholder}
        contentFit="cover"
        blurRadius={60}
        accessible={false}
      />
      <View style={[StyleSheet.absoluteFill, styles.dim]} />
      {photo.type === "video" ? (
        <VideoSlide photo={photo} token={token} paused={paused} muted={muted} />
      ) : (
        <Image
          style={StyleSheet.absoluteFill}
          source={mediaSource(photo.originalPath, token)}
          placeholder={mediaSource(photo.thumbPath, token)}
          placeholderContentFit="contain"
          contentFit="contain"
          transition={200}
          accessible={false}
        />
      )}
      <View style={styles.caption} pointerEvents="none">
        <View style={styles.author}>
          <View style={[styles.dot, { backgroundColor: memberColor(photo.author.id) }]} />
          <Text style={styles.name}>{photo.author.name}</Text>
          <Text style={styles.time}>{formatTime(photo.takenAt, timeZone)}</Text>
        </View>
        {photo.caption ? <Text style={styles.quote}>{photo.caption}</Text> : null}
      </View>
    </View>
  );
}

function VideoSlide({
  photo,
  token,
  paused,
  muted,
}: {
  photo: RevealedPhoto;
  token: string;
  paused: boolean;
  muted: boolean;
}) {
  const { uri, headers } = mediaSource(photo.originalPath, token);
  const player = useVideoPlayer({ uri, headers }, (p) => {
    p.loop = false;
    p.muted = true;
    p.play();
  });
  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);
  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [player, paused]);
  return <VideoView style={StyleSheet.absoluteFill} player={player} contentFit="contain" nativeControls={false} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },
  dim: { backgroundColor: "rgba(0,0,0,0.45)" },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: 48,
    gap: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  author: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { ...type.headline, color: "#fff" },
  time: { ...type.subhead, color: "rgba(255,255,255,0.7)" },
  quote: { ...type.quote, color: "#fff" },
});
