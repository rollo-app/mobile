import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { StyleSheet, View } from "react-native";
import { radius } from "@/ui/theme";
import { STORY_W } from "./card-layout";
import { STYLE_ASSETS, STYLE_PALETTE, type StoryStyle } from "./story-style";

export const STORY_RATIO = 9 / 16;

/** The style's video, looping and muted. One player per style: the parent keys it by style so a switch makes a new one. */
function StyleVideo({ style }: { style: StoryStyle }) {
  const player = useVideoPlayer(STYLE_ASSETS[style].video, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} contentFit="cover" nativeControls={false} style={StyleSheet.absoluteFill} />;
}

/** A 9:16 box: the style's base color, its video looping on top (the base shows until the first frame) and the card centered over it. */
export function StoryPreview({ style, card, height }: { style: StoryStyle; card: { uri: string; width: number; height: number } | null; height: number }) {
  return (
    <View testID="story-preview" style={[styles.box, { height, backgroundColor: STYLE_PALETTE[style].base }]}>
      <StyleVideo key={style} style={style} />
      {card !== null && (
        <Image
          accessibilityLabel="Vista previa"
          source={{ uri: card.uri }}
          cachePolicy="none"
          contentFit="contain"
          style={{ width: `${(card.width / STORY_W) * 100}%`, aspectRatio: card.width / card.height }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: "center", aspectRatio: STORY_RATIO, alignItems: "center", justifyContent: "center", borderRadius: radius.lg, borderCurve: "continuous", overflow: "hidden" },
});
