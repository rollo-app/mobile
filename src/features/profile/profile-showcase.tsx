import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from "react-native";
import { FeaturedGrid } from "@/features/featured/featured-grid";
import { FeaturedMap } from "@/features/featured/featured-map";
import { useFeatured } from "@/features/featured/use-featured";
import { zonesOf } from "@/features/featured/zones";
import { useMediaToken } from "@/features/media/revealed";
import { Button, ErrorText } from "@/ui/components";
import { colors, spacing, tintHex, type } from "@/ui/theme";

const VIEWS = ["Fotos", "Mapa"];

const EMPTY = {
  own: {
    photos: "Cuando se revele un rollo, vas a poder elegir tus mejores fotos para mostrar acá.",
    places: "Acá vas a ver las zonas donde sacaste tus fotos destacadas.",
  },
  friend: {
    photos: "Todavía no destacó fotos.",
    places: "Todavía no hay lugares.",
  },
} as const;

type Props = {
  /** Your own profile (picks the empty-state copy). */
  own: boolean;
  /** Whose featured photos to show. */
  userId: string;
  /** Whether you may see them: without permission nothing is requested and the profile shows as private. */
  canSee: boolean;
};

/**
 * What a profile shows off: "Fotos | Mapa". Fotos is the grid of featured photos (tap one to open the
 * featured viewer); Mapa, the ~5 km zones where they were taken.
 */
export function ProfileShowcase({ own, userId, canSee }: Props) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const [view, setView] = useState<"photos" | "places">("photos");
  const target = canSee ? userId : undefined;
  const { photos, error, loading, refetch, isRefetching } = useFeatured(target);
  // Read only once there's something to load.
  const token = useMediaToken(photos && photos.length > 0 ? target : undefined);
  const zones = useMemo(() => zonesOf(photos ?? []), [photos]);
  const copy = EMPTY[own ? "own" : "friend"];

  if (!canSee) {
    return (
      <View testID="profile-showcase" style={styles.private}>
        <SymbolView name="lock.fill" size={22} tintColor={colors.secondaryLabel as string} />
        <Text style={[type.headline, { color: colors.label }]}>Este perfil es privado</Text>
      </View>
    );
  }

  let content;
  if (!photos) {
    content = error ? (
      <View style={styles.error}>
        <ErrorText>{error}</ErrorText>
        <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
      </View>
    ) : (
      loading && <ActivityIndicator style={styles.loading} />
    );
  } else if (view === "photos") {
    content =
      photos.length > 0 ? (
        <FeaturedGrid photos={photos} token={token} onOpen={(p) => router.push(`/featured/${userId}/${p.mediaId}`)} />
      ) : (
        <Text style={[type.subhead, styles.empty]}>{copy.photos}</Text>
      );
  } else {
    content = zones.length > 0 ? <FeaturedMap zones={zones} /> : <Text style={[type.subhead, styles.empty]}>{copy.places}</Text>;
  }

  return (
    <View testID="profile-showcase" style={styles.showcase}>
      <SegmentedControl
        style={styles.segmented}
        values={VIEWS}
        tintColor={tintHex[scheme]}
        selectedIndex={view === "photos" ? 0 : 1}
        onValueChange={(v) => setView(v === "Mapa" ? "places" : "photos")}
      />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  showcase: { gap: spacing.lg },
  // No horizontal margin of its own: `Screen`'s 16 pt padding aligns it with the header and the large title (the grid bleeds out of it).
  segmented: { height: 32 },
  empty: { color: colors.secondaryLabel, textAlign: "center", paddingHorizontal: spacing.xl, paddingVertical: spacing.xl },
  loading: { paddingVertical: spacing.xl },
  error: { gap: spacing.md },
  private: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
});
