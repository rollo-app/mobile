import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { errorMessage } from "@/api/client";
import { ErrorText, Loading } from "@/ui/components";
import { colors, radius, spacing, type } from "@/ui/theme";
import { bandHeight, clampFocus, focusFromTop, stepFocus, topFromFocus } from "./cover-focus";
import { coverUri } from "./cover-uri";
import { useTripDetail } from "./use-trip-detail";
import { useUpdateCoverFocus } from "./use-update-cover-focus";

/** The Rollos list card is full width minus the list's side margins, 180 pt tall (`LiveRollCard`). */
const CARD_HEIGHT = 180;
const LIST_MARGIN = spacing.md;
// Room kept above and below the photo for the header, the hint and the safe areas.
const CHROME = 220;
const DIM = "rgba(0,0,0,0.55)";

/** "Qué se ve en la lista": drag a band over the whole cover to pick the part the Rollos list shows. `uri` is a local photo just picked. */
export function CoverFocusScreen({ tripId, uri }: { tripId: string; uri?: string }) {
  const { detail } = useTripDetail(tripId);
  if (!detail) return <Loading />;
  return <FocusBand tripId={tripId} source={uri ?? coverUri(detail.trip.coverUrl)} initial={detail.trip.coverFocusY ?? 0.5} />;
}

function FocusBand({ tripId, source, initial }: { tripId: string; source: string | null; initial: number }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // The 3:4 photo fit to the width (or the height left), and the band with the card's aspect across it.
  const photoWidth = Math.min(width - 2 * spacing.md, ((height - insets.top - insets.bottom - CHROME) * 3) / 4);
  const photoHeight = (photoWidth * 4) / 3;
  const band = bandHeight(photoWidth, width - 2 * LIST_MARGIN, CARD_HEIGHT);

  const [focus, setFocus] = useState(initial);
  const top = useSharedValue(topFromFocus(initial, photoHeight, band));
  const start = useSharedValue(0);
  const save = useUpdateCoverFocus(tripId);

  // The focus is the source of truth for save and VoiceOver; the drag runs on the UI thread and settles into it on release.
  useEffect(() => {
    top.value = topFromFocus(focus, photoHeight, band);
  }, [focus, photoHeight, band, top]);

  const settle = useCallback((y: number) => setFocus(focusFromTop(y, photoHeight, band)), [photoHeight, band]);
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .withTestId("cover-focus-pan")
        .onStart(() => {
          start.value = top.value;
        })
        .onUpdate((e) => {
          top.value = Math.min(Math.max(0, photoHeight - band), Math.max(0, start.value + e.translationY));
        })
        .onEnd(() => {
          scheduleOnRN(settle, top.value);
        }),
    [top, start, photoHeight, band, settle],
  );

  const bandStyle = useAnimatedStyle(() => ({ transform: [{ translateY: top.value }] }));
  const aboveStyle = useAnimatedStyle(() => ({ height: top.value }));
  const belowStyle = useAnimatedStyle(() => ({ top: top.value + band }));

  const done = () => save.mutate(focus, { onSuccess: () => router.back() });

  return (
    <View style={styles.screen}>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={() => router.back()}>Cancelar</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        {save.isPending ? (
          <Stack.Toolbar.View>
            <ActivityIndicator />
          </Stack.Toolbar.View>
        ) : (
          <Stack.Toolbar.Button variant="done" onPress={done}>
            Listo
          </Stack.Toolbar.Button>
        )}
      </Stack.Toolbar>

      <Text style={[type.subhead, styles.hint]}>Arrastrá el recuadro para elegir qué parte de la portada se ve en la lista de rollos.</Text>
      <View style={{ width: photoWidth, height: photoHeight, borderRadius: radius.md, borderCurve: "continuous", overflow: "hidden" }}>
        <Image source={source ? { uri: source } : undefined} contentFit="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
        <Animated.View pointerEvents="none" style={[styles.dim, { top: 0 }, aboveStyle]} />
        <Animated.View pointerEvents="none" style={[styles.dim, { bottom: 0 }, belowStyle]} />
        <GestureDetector gesture={pan}>
          <Animated.View
            testID="cover-focus-band"
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Parte visible en la lista"
            accessibilityValue={{ text: `${Math.round(focus * 100)}% desde arriba` }}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={({ nativeEvent }) => {
              if (nativeEvent.actionName === "increment") setFocus((f) => stepFocus(f, 1));
              else if (nativeEvent.actionName === "decrement") setFocus((f) => stepFocus(f, -1));
            }}
            style={[styles.band, { height: band }, bandStyle]}
          />
        </GestureDetector>
      </View>
      {!!save.error && <ErrorText>{errorMessage(save.error, "No se pudo guardar")}</ErrorText>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", gap: spacing.md, paddingTop: spacing.md, backgroundColor: colors.groupedBackground },
  hint: { color: colors.secondaryLabel, textAlign: "center", paddingHorizontal: spacing.lg },
  dim: { position: "absolute", left: 0, right: 0, backgroundColor: DIM },
  band: { position: "absolute", top: 0, left: 0, right: 0, borderWidth: 3, borderColor: "#FFFFFF", borderRadius: radius.sm, borderCurve: "continuous" },
});
