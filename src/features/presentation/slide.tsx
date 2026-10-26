import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { likeRed } from "@/features/likes/colors";
import { Avatar } from "@/features/profile/avatar";
import { MomentBadge } from "@/features/media/moment-badge";
import { SelfieInset } from "@/features/media/selfie-inset";
import { mediaSource, type RevealedPhoto } from "@/features/media/revealed";
import { formatTime } from "@/features/trips/phase";
import { spacing, type } from "@/ui/theme";

/** What VoiceOver reads for a slide: who, when and the caption. */
export function slideLabel(photo: RevealedPhoto, timeZone: string) {
  const what = photo.type === "video" ? "Video" : "Foto";
  const base = `${what} de ${photo.author.name}, ${formatTime(photo.takenAt, timeZone)}`;
  return photo.caption ? `${base}. ${photo.caption}` : base;
}

/**
 * A photo or video full screen over a blurred copy of itself, with author and caption below. Photos get a
 * heart at the bottom right (no counter): outline, system red once you like it; tapping it toggles.
 */
export function Slide({
  photo,
  token,
  timeZone,
  paused,
  muted,
  onAuthor,
  liked,
  onToggleLike,
}: {
  photo: RevealedPhoto;
  token: string;
  timeZone: string;
  paused: boolean;
  muted: boolean;
  /** Tapping the author's photo or name; it takes the press, so the story's tap zones don't. */
  onAuthor: () => void;
  /** Whether you like it now (the slide's `photo` can be older than the feed). */
  liked: boolean;
  onToggleLike: () => void;
}) {
  // The moment's selfie can take the big picture (the slide is remounted per photo, so this resets).
  const [selfieBig, setSelfieBig] = useState(false);
  const bigThumb = selfieBig && photo.selfie ? photo.selfie.thumbPath : photo.thumbPath;
  const bigOriginal = selfieBig && photo.selfie ? photo.selfie.originalPath : photo.originalPath;
  const placeholder = !selfieBig && photo.thumbhash ? { thumbhash: photo.thumbhash } : undefined;
  return (
    <View style={styles.fill}>
      {/* The media is one VoiceOver element; the author button stays reachable on its own. */}
      <View style={StyleSheet.absoluteFill} accessible accessibilityLabel={slideLabel(photo, timeZone)}>
        <Image
          style={StyleSheet.absoluteFill}
          source={mediaSource(bigThumb, token)}
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
            source={mediaSource(bigOriginal, token)}
            placeholder={mediaSource(bigThumb, token)}
            placeholderContentFit="contain"
            contentFit="contain"
            transition={200}
            accessible={false}
          />
        )}
      </View>
      {photo.selfie ? (
        <SelfieInset photo={photo} token={token} selfieBig={selfieBig} onToggle={() => setSelfieBig((v) => !v)} style={styles.moment} />
      ) : photo.momentDay ? (
        <MomentBadge style={styles.moment} />
      ) : null}
      <View style={styles.caption} pointerEvents="box-none">
        <View style={styles.header} pointerEvents="box-none">
          <View style={styles.author} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Perfil de ${photo.author.name}`}
              onPress={onAuthor}
              // Its own long press keeps a hold on the author from pausing the story behind it.
              onLongPress={() => {}}
              style={({ pressed }) => [styles.author, pressed && styles.pressed]}
            >
              <Avatar id={photo.author.id} name={photo.author.name} avatarUrl={photo.author.avatarUrl} size={40} />
              <Text style={styles.name}>{photo.author.name}</Text>
            </Pressable>
            <Text style={styles.time} pointerEvents="none">
              {formatTime(photo.takenAt, timeZone)}
            </Text>
          </View>
          {photo.type === "photo" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={liked ? "Ya no me gusta" : "Me gusta"}
              hitSlop={8}
              onPress={onToggleLike}
              // Like the author button: a hold on the heart doesn't pause the story behind it.
              onLongPress={() => {}}
              style={({ pressed }) => [styles.heart, pressed && styles.pressed]}
            >
              <SymbolView testID="story-heart" name={liked ? "heart.fill" : "heart"} size={26} tintColor={liked ? likeRed : "#FFFFFF"} />
            </Pressable>
          )}
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
  // Below the progress bar and the close button of the player.
  moment: { position: "absolute", left: spacing.md, top: 96 },
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  author: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
  heart: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.6 },
  name: { ...type.headline, color: "#fff" },
  time: { ...type.subhead, color: "rgba(255,255,255,0.7)" },
  quote: { ...type.quote, color: "#fff" },
});
