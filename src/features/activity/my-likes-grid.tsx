import { Image } from "expo-image";
import { FlatList, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { AuthorBadge } from "@/features/featured/author-badge";
import { mediaSource } from "@/features/media/revealed";
import { colors } from "@/ui/theme";
import type { LikedPhoto } from "./actions";

const COLUMNS = 3;
const GAP = 2;

const label = (photo: LikedPhoto, myId: string | undefined) => (photo.authorUserId === myId ? "Foto tuya" : `Foto de ${photo.author.name}`);

/** The photos you liked, three per row, edge to edge; the author's badge on other people's. Asks for more at the end. */
export function MyLikesGrid({
  photos,
  token,
  myId,
  onOpen,
  onEnd,
  footer,
}: {
  photos: LikedPhoto[];
  token: string | null;
  myId: string | undefined;
  onOpen: (photo: LikedPhoto) => void;
  onEnd: () => void;
  footer?: React.ReactElement;
}) {
  const { width } = useWindowDimensions();
  const size = Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS);
  return (
    <FlatList
      testID="my-likes-grid"
      data={photos}
      keyExtractor={(p) => p.mediaId}
      numColumns={COLUMNS}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      contentInsetAdjustmentBehavior="automatic"
      onEndReached={onEnd}
      onEndReachedThreshold={0.5}
      ListFooterComponent={footer}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label(item, myId)}
          onPress={() => onOpen(item)}
          style={{ width: size, height: size, backgroundColor: colors.latent }}
        >
          {token && (
            <Image
              source={mediaSource(item.thumbPath, token)}
              placeholder={item.thumbHash ? { thumbhash: item.thumbHash } : undefined}
              transition={120}
              contentFit="cover"
              recyclingKey={item.mediaId}
              style={StyleSheet.absoluteFill}
            />
          )}
          {item.authorUserId !== myId && <AuthorBadge author={item.author} />}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  grid: { gap: GAP },
  row: { gap: GAP },
});
