import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { useRevealedPhotos } from "@/features/media/revealed";
import { useReduceMotion } from "@/features/presentation/use-accessibility";
import { formatDate } from "@/features/trips/phase";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { markRevealIntroSeen } from "@/storage/reveal-intro";
import { DarkroomIntro } from "./darkroom-intro";
import { REVEAL_TIMELINE } from "./timeline";

/** The screen's own background, painted from the first frame: the darkroom's red-black. */
export const REVEAL_BACKGROUND = "#1a0000";

/**
 * The reveal of the active roll, full screen and on its own (the stories never contain it): the
 * darkroom (`DarkroomIntro`). It always plays, and remembers it was seen as it starts.
 * When it ends, or with a tap anywhere, it replaces itself with the stories (`/presentation`).
 * Without photos (once the server confirmed it) or on an error it goes straight there, where that state is explained. While it
 * loads, a tap or `loadingTimeoutMs` also goes there.
 */
export function RevealScreen() {
  const { trip } = useActiveTrip();
  const { detail } = useTripDetail(trip?.id);
  const { photos, token, error, loading, refetch } = useRevealedPhotos(trip?.id);
  const reduceMotion = useReduceMotion();
  const tripId = trip?.id;

  // Opened right at the reveal, the cached feed is still the one from before it (no files yet):
  // it only gives up on the photos once the server answered.
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!tripId) return;
    let active = true;
    void refetch({ cancelRefetch: false }).finally(() => active && setChecked(true));
    return () => {
      active = false;
    };
  }, [tripId, refetch]);

  const done = useRef(false);
  const toStories = useCallback(() => {
    if (done.current) return;
    done.current = true;
    router.replace("/presentation");
  }, []);

  // Before `checked` the cache may hold only the daily moments from before the reveal: wait for the full feed.
  const ready = checked && !!detail && !!token && photos.length > 0;
  const nothing = checked && !ready && !loading && (!!error || (!!detail && !!token && photos.length === 0));

  useEffect(() => {
    if (nothing) toStories();
  }, [nothing, toStories]);

  useEffect(() => {
    if (!ready || !tripId) return;
    void markRevealIntroSeen(tripId);
    const timer = setTimeout(toStories, REVEAL_TIMELINE.totalMs);
    return () => clearTimeout(timer);
  }, [ready, tripId, toStories]);

  // A safety net while it loads: with weak signal a request can hang, and the stories have their own
  // loading and error states.
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(toStories, REVEAL_TIMELINE.loadingTimeoutMs);
    return () => clearTimeout(timer);
  }, [ready, toStories]);

  if (!ready) {
    return (
      <Pressable
        testID="reveal-loading"
        style={[styles.root, styles.loading]}
        accessibilityLabel="Cargando el revelado"
        accessibilityHint="Tocá para ver las fotos"
        accessibilityActions={[{ name: "escape", label: "Ver las fotos" }]}
        onAccessibilityAction={toStories}
        onPress={toStories}
      >
        <StatusBar style="light" />
        <ActivityIndicator color="#fff" />
      </Pressable>
    );
  }

  return (
    <Pressable testID="reveal-surface" style={styles.root} accessibilityHint="Tocá para ver las fotos" onPress={toStories}>
      <StatusBar style="light" />
      <DarkroomIntro
        photos={photos}
        token={token}
        title={detail.trip.name}
        date={formatDate(detail.trip.revealAt, detail.trip.timezone)}
        reduceMotion={reduceMotion}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: REVEAL_BACKGROUND },
  loading: { alignItems: "center", justifyContent: "center" },
});
