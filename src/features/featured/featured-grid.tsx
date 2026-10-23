import { Image } from "expo-image";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { mediaSource } from "@/features/media/revealed";
import { colors, spacing } from "@/ui/theme";
import type { FeaturedPhoto } from "./actions";
import { AuthorBadge } from "./author-badge";

const COLUMNS = 3;
const GAP = 2;

/** What a featured photo is called on screen and for VoiceOver. */
export function featuredLabel(photo: FeaturedPhoto) {
  return photo.author ? `Foto de ${photo.author.name}` : "Foto destacada";
}

/**
 * A profile's featured photos, three per row, edge to edge (it bleeds out of the screen's padding).
 * Plain rows instead of a FlatList: it lives inside the profile's ScrollView and there are 60 at most.
 */
export function FeaturedGrid({
  photos,
  token,
  onOpen,
}: {
  photos: FeaturedPhoto[];
  token: string | null;
  onOpen: (photo: FeaturedPhoto) => void;
}) {
  const { width } = useWindowDimensions();
  const size = Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS);
  const rows: FeaturedPhoto[][] = [];
  for (let i = 0; i < photos.length; i += COLUMNS) rows.push(photos.slice(i, i + COLUMNS));

  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0]!.mediaId} style={styles.row}>
          {row.map((photo) => (
            <Pressable
              key={photo.mediaId}
              accessibilityRole="button"
              accessibilityLabel={featuredLabel(photo)}
              onPress={() => onOpen(photo)}
              style={{ width: size, height: size, backgroundColor: colors.latent }}
            >
              {token && (
                <Image
                  source={mediaSource(photo.thumbPath, token)}
                  placeholder={photo.thumbhash ? { thumbhash: photo.thumbhash } : undefined}
                  transition={120}
                  contentFit="cover"
                  recyclingKey={photo.mediaId}
                  style={StyleSheet.absoluteFill}
                />
              )}
              {photo.author && <AuthorBadge author={photo.author} />}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: GAP, marginHorizontal: -spacing.md },
  row: { flexDirection: "row", gap: GAP },
});
