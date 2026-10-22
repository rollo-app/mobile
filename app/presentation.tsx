import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRevealedPhotos } from "@/features/media/revealed";
import { StoryPlayer } from "@/features/presentation/story-player";
import { useRevealIntro } from "@/features/presentation/use-reveal-intro";
import { formatDate } from "@/features/trips/phase";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { spacing, type } from "@/ui/theme";

/**
 * The reveal presentation: fullscreen and dark, for the active roll. The intro plays only the first
 * time per roll on this phone; `forceIntro` (dev "Ver revelado") always plays it.
 */
export default function PresentationScreen() {
  const router = useRouter();
  const { forceIntro } = useLocalSearchParams<{ forceIntro?: string }>();
  const { trip } = useActiveTrip();
  const { showIntro, onIntroStart } = useRevealIntro(trip?.id, forceIntro === "1");
  const { detail } = useTripDetail(trip?.id);
  const { photos, token, error, loading, refetch } = useRevealedPhotos(trip?.id);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  if (detail && token && photos.length > 0 && showIntro !== null) {
    return (
      <StoryPlayer
        photos={photos}
        token={token}
        timeZone={detail.trip.timezone}
        title={detail.trip.name}
        revealDate={formatDate(detail.trip.revealAt, detail.trip.timezone)}
        skipIntro={!showIntro}
        onIntroStart={onIntroStart}
        onClose={close}
      />
    );
  }

  const waiting = !error && (loading || !detail || !token || showIntro === null);
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
