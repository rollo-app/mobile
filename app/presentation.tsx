import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRevealedPhotos } from "@/features/media/revealed";
import { StoryPlayer } from "@/features/presentation/story-player";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { spacing, type } from "@/ui/theme";

/**
 * The presentation's stories: fullscreen and black, for the active roll. The reveal intro isn't
 * here: it's `/reveal`, which hands over to this screen.
 */
export default function PresentationScreen() {
  const router = useRouter();
  const { trip } = useActiveTrip();
  const { detail } = useTripDetail(trip?.id);
  const { photos, token, error, loading, refetch } = useRevealedPhotos(trip?.id);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  if (detail && token && photos.length > 0) {
    return <StoryPlayer photos={photos} token={token} timeZone={detail.trip.timezone} onClose={close} />;
  }

  const waiting = !error && (loading || !detail || !token);
  return (
    <View style={styles.center}>
      {waiting ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Text style={styles.message}>{error ?? "Todavía no hay fotos para mostrar."}</Text>
          {error ? (
            <Pressable accessibilityRole="button" onPress={() => void refetch()}>
              <Text style={styles.action}>Reintentar</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={close}>
            <Text style={styles.action}>Cerrar</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  message: { ...type.body, color: "rgba(255,255,255,0.75)", textAlign: "center" },
  action: { ...type.headline, color: "#5C7CFF" },
});
