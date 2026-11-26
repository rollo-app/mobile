import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { filmCandidates, FILM_MAX } from "@/features/journey/film-photos";
import { type RevealedPhoto, useRevealedPhotos } from "@/features/media/revealed";
import { Loading } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { COLLAGE_MAX, collageCandidates } from "./collage";
import { collagePhotos, getCollageSelection, setCollageSelection, toggleSelection } from "./collage-selection";
import { getFilmSelection, getFilmShown, setFilmSelection } from "./film-selection";
import { PickCell } from "./pick-cell";
import { PickTray, TRAY_HEIGHT } from "./pick-tray";

const COLUMNS = 4;
const GAP = 4;
const PADDING = 12;

const keyExtractor = (photo: RevealedPhoto) => photo.id;

/**
 * "Elegir fotos": pick up to 8 shareable photos for the collage (the tap order is the collage order, 1 is the big photo), or for
 * `kind="journey"` up to 15 photos with coordinates for the film (the order does not matter).
 */
export function SharePickScreen({ tripId, seed, kind = "collage" }: { tripId: string; seed?: number; kind?: "collage" | "journey" }) {
  const journey = kind === "journey";
  const max = journey ? FILM_MAX : COLLAGE_MAX;
  const { photos, token, complete, loading, loadAll } = useRevealedPhotos(tripId);
  const candidates = useMemo(() => (journey ? filmCandidates(photos) : collageCandidates(photos)), [journey, photos]);
  // Seeded from the saved selection, minus ids that are no longer candidates (they would count toward the cap).
  const [draft, setDraft] = useState<string[]>(() => [...(journey ? getFilmSelection(tripId) : getCollageSelection(tripId))]);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const seeded = useRef(false);
  useEffect(() => {
    // Only once every page is in: before that a saved id may just be on a page not loaded yet. Taps stay open meanwhile.
    if (seeded.current || !complete) return;
    seeded.current = true;
    const known = new Set(candidates.map((p) => p.id));
    let next = draftRef.current.filter((id) => known.has(id));
    // Nothing saved: start from the photos the collage shows right now (same seed as "Compartir"), in collage order.
    if (next.length === 0 && journey) {
      // The photos the film is made of now (Compartir saved them); without them, the first candidates.
      const shown = getFilmShown(tripId).filter((id) => known.has(id));
      next = shown.length > 0 ? shown : candidates.slice(0, FILM_MAX).map((p) => p.id);
    }
    else if (next.length === 0 && seed !== undefined) next = collagePhotos(candidates, [], seed).map((p) => p.id);
    draftRef.current = next;
    setDraft(next);
  }, [complete, candidates, seed, journey, tripId]);
  // The grid shows the whole roll: load the rest of the pages once.
  const asked = useRef(false);
  useEffect(() => {
    if (complete || asked.current) return;
    asked.current = true;
    void loadAll();
  }, [complete, loadAll]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Each slot gets GAP / 2 on both sides, so the content padding is PADDING - GAP / 2 to keep PADDING at the edges.
  const edge = PADDING - GAP / 2;
  const size = Math.floor((width - edge * 2) / COLUMNS - GAP);
  const photosById = useMemo(() => new Map(candidates.map((p) => [p.id, p])), [candidates]);
  const full = draft.length >= max;

  const onPress = useCallback((id: string) => {
    const result = toggleSelection(draftRef.current, id, max);
    if (result.full) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else {
      draftRef.current = result.selection;
      setDraft(result.selection);
    }
  }, [max]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const done = () => {
    if (journey) setFilmSelection(tripId, draft);
    else setCollageSelection(tripId, draft);
    goBack();
  };

  const renderItem = useCallback(
    ({ item, index: position }: ListRenderItemInfo<RevealedPhoto>) => {
      const index = draft.indexOf(item.id);
      return (
        <View style={styles.slot}>
          <PickCell photo={item} index={position} total={candidates.length} token={token} size={size} order={index >= 0 ? index + 1 : null} numbered={!journey} dimmed={full && index < 0} onPress={onPress} />
        </View>
      );
    },
    [draft, token, size, full, candidates.length, onPress, journey],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerTransparent: false,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerBlurEffect: "none",
          headerTitle: () => <HeaderTitle journey={journey} />,
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={goBack}>Cancelar</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button variant="done" onPress={done}>
          Listo
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      {!complete && loading ? (
        <Loading />
      ) : (
        <FlashList
          data={candidates}
          numColumns={COLUMNS}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          extraData={draft}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{ paddingHorizontal: edge, paddingTop: GAP / 2, paddingBottom: TRAY_HEIGHT + insets.bottom + spacing.sm }}
        />
      )}
      <PickTray max={max} subject={journey ? "recorrido" : "collage"} numbered={!journey} selection={draft} photos={photosById} token={token} bottomInset={insets.bottom} onRemove={onPress} />
    </View>
  );
}

function HeaderTitle({ journey }: { journey: boolean }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={[type.headline, styles.title]}>Elegir fotos</Text>
      {!journey && <Text style={[type.caption, styles.subtitle]}>la 1 va grande</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  titleBlock: { alignItems: "center" },
  title: { color: colors.label },
  subtitle: { color: colors.secondaryLabel },
  // Each slot leaves GAP / 2 on every side, so neighbours are GAP apart.
  slot: { alignItems: "center", paddingHorizontal: GAP / 2, paddingVertical: GAP / 2 },
});
