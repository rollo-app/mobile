import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRevealedPhotos } from "@/features/media/revealed";
import { DarkroomIntro } from "@/features/presentation/darkroom-intro";
import { Intro } from "@/features/presentation/intro";
import { REVEAL_INTRO_MS, USE_DARKROOM_INTRO } from "@/features/presentation/intro-flag";
import { useReduceMotion } from "@/features/presentation/use-accessibility";
import { formatDate } from "@/features/trips/phase";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { markRevealIntroSeen } from "@/storage/reveal-intro";

/** The screen's own background, painted from the first frame: the darkroom's red-black, or black for the mosaic. */
export const REVEAL_BACKGROUND = USE_DARKROOM_INTRO ? "#1a0000" : "#000000";

/**
 * The reveal of the active roll, full screen and on its own (the stories never contain it): the
 * darkroom intro (or the original mosaic). It always plays, and remembers it was seen as it starts.
 * When it ends, or with a tap anywhere, it replaces itself with the stories (`/presentation`).
 * Without photos or on an error it goes straight there, where that state is explained.
 */
export function RevealScreen() {
  const { trip } = useActiveTrip();
  const { detail } = useTripDetail(trip?.id);
  const { photos, token, error, loading } = useRevealedPhotos(trip?.id);
  const reduceMotion = useReduceMotion();

  const done = useRef(false);
  const toStories = useCallback(() => {
    if (done.current) return;
    done.current = true;
    router.replace("/presentation");
  }, []);

  const ready = !!detail && !!token && photos.length > 0;
  const nothing = !ready && !loading && (!!error || (!!detail && !!token && photos.length === 0));

  useEffect(() => {
    if (nothing) toStories();
  }, [nothing, toStories]);

  const tripId = trip?.id;
  useEffect(() => {
    if (!ready || !tripId) return;
    void markRevealIntroSeen(tripId);
    const timer = setTimeout(toStories, REVEAL_INTRO_MS);
    return () => clearTimeout(timer);
  }, [ready, tripId, toStories]);

  if (!ready) return <View style={styles.root} />;

  const props = {
    photos,
    token,
    title: detail.trip.name,
    date: formatDate(detail.trip.revealAt, detail.trip.timezone),
    reduceMotion,
  };
  return (
    <Pressable testID="reveal-surface" style={styles.root} accessibilityHint="Tocá para ver las fotos" onPress={toStories}>
      <StatusBar style="light" />
      {USE_DARKROOM_INTRO ? <DarkroomIntro {...props} /> : <Intro {...props} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: REVEAL_BACKGROUND },
});
