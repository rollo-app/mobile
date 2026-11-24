import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { mediaSource, type RevealedPhoto } from "@/features/media/revealed";
import { colors } from "@/ui/theme";
import { useImageRetry } from "@/ui/use-image-retry";

type Props = {
  photo: RevealedPhoto;
  token: string | null;
  size: number;
  picked: boolean;
  onPress: (photo: RevealedPhoto) => void;
};

/** One photo of the picking grid: a thumbnail with a check when it's a finalist. */
export const PickCell = memo(function PickCell({ photo, token, size, picked, onPress }: Props) {
  // A thumbnail the server refused (429 while scrolling fast) tries again by itself.
  const retry = useImageRetry(photo.id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Foto de ${photo.author.name}`}
      accessibilityState={{ selected: picked }}
      onPress={() => onPress(photo)}
      style={{ width: size, height: size, backgroundColor: colors.latent }}
    >
      {!!token && (
        <Image
          key={retry.retryKey}
          testID={`pick-thumb-${photo.id}`}
          onError={retry.onError}
          onLoad={retry.onLoad}
          source={mediaSource(photo.thumbPath, token)}
          placeholder={photo.thumbhash ? { thumbhash: photo.thumbhash } : undefined}
          transition={120}
          contentFit="cover"
          recyclingKey={photo.id}
          style={[StyleSheet.absoluteFill, picked && styles.picked]}
        />
      )}
      <View style={[styles.check, picked && styles.checkOn]}>
        {picked && <SymbolView name="checkmark" size={12} weight="bold" tintColor={colors.onTint as string} />}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  picked: { opacity: 0.8 },
  check: {
    position: "absolute",
    right: 5,
    bottom: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.tint, borderColor: colors.tint },
});
