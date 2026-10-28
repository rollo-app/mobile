import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useDoubleTap } from "@/features/likes/use-double-tap";
import { mediaSource, type RevealedPhoto } from "@/features/media/revealed";

function VideoPage({ photo, token, active }: { photo: RevealedPhoto; token: string; active: boolean }) {
  const player = useVideoPlayer(mediaSource(photo.originalPath, token), (p) => {
    p.loop = true;
  });
  if (!active) return <Image source={mediaSource(photo.thumbPath, token)} contentFit="contain" style={StyleSheet.absoluteFill} />;
  return <VideoView player={player} nativeControls contentFit="contain" style={StyleSheet.absoluteFill} />;
}

export function ViewerPage({
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
