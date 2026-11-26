import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { filmCandidates, FILM_MAX } from "@/features/journey/film-photos";
import { formatSheetCounter, nextState, SHEET_MAX, type SheetChoices, type SheetState, sheetCandidates, sheetStates } from "@/features/journey/sheet/sheet-photos";
import { type RevealedPhoto, useRevealedPhotos } from "@/features/media/revealed";
import { Loading } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { COLLAGE_MAX, collageCandidates } from "./collage";
import { collagePhotos, getCollageSelection, setCollageSelection, toggleSelection } from "./collage-selection";
import { getFilmSelection, getFilmShown, setFilmSelection } from "./film-selection";
import { PickCell, SheetPickCell } from "./pick-cell";
import { PickTray, SHEET_TRAY_HEIGHT, SheetPickTray, TRAY_HEIGHT } from "./pick-tray";
import { getSheetChoices, setSheetChoices } from "./sheet-selection";

const COLUMNS = 4;
const GAP = 4;
const PADDING = 12;

const keyExtractor = (photo: RevealedPhoto) => photo.id;

/**
 * "Elegir fotos": pick up to 8 shareable photos for the collage (the tap order is the collage order, 1 is the big photo), or for
 * `kind="journey"` up to 15 photos with coordinates for the film (the order does not matter), or for `kind="sheet"` the state of
 * each photo of the summary film (on the sheet, highlighted or out).
 */
export function SharePickScreen({ tripId, seed, kind = "collage" }: { tripId: string; seed?: number; kind?: "collage" | "journey" | "sheet" }) {
  if (kind === "sheet") return <SheetPickScreen tripId={tripId} />;
  return <OrderedPickScreen tripId={tripId} seed={seed} kind={kind} />;
}

function OrderedPickScreen({ tripId, seed, kind }: { tripId: string; seed?: number; kind: "collage" | "journey" }) {
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
          headerTitle: () => <HeaderTitle subtitle={journey ? undefined : "la 1 va grande"} />,
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

/** The summary film's picker: the grid starts from the states the film has now; only "Listo" saves them. */
function SheetPickScreen({ tripId }: { tripId: string }) {
  const { photos, token, complete, loadAll } = useRevealedPhotos(tripId);
  const candidates = useMemo(() => sheetCandidates(photos), [photos]);
  // Only the photos the person tapped enter the draft (the first tap also seeds the shown highlights); the rest follow the automatic pick.
  const [draft, setDraft] = useState<SheetChoices>(() => getSheetChoices(tripId));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  // The states are frozen by the first tap, so the grid opens only once every page is in (or loading them failed).
  const [loadedAll, setLoadedAll] = useState(false);
  const asked = useRef(false);
  useEffect(() => {
    if (complete || asked.current) return;
    asked.current = true;
    const done = () => setLoadedAll(true);
    loadAll().then(done, done);
  }, [complete, loadAll]);
  const ready = complete || loadedAll;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const edge = PADDING - GAP / 2;
  const size = Math.floor((width - edge * 2) / COLUMNS - GAP);
  const states = useMemo(() => sheetStates(candidates, draft), [candidates, draft]);
  const statesRef = useRef(states);
  statesRef.current = states;
  const candidatesRef = useRef(candidates);
  candidatesRef.current = candidates;
  const counter = useMemo(() => {
    const values = Object.values(states);
    return formatSheetCounter(values.filter((s) => s === "highlight").length, values.filter((s) => s === "sheet").length);
  }, [states]);

  const onPress = useCallback((id: string) => {
    const current = statesRef.current[id];
    if (current === undefined) return;
    const shown = statesRef.current;
    const highlighted = Object.values(shown).filter((state) => state === "highlight").length;
    // The 13th highlight is skipped: the photo goes out instead, with the same haptic as a full collage.
    const next = nextState(current, highlighted);
    if (current === "sheet" && next === "out") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const hand = candidatesRef.current.filter((p) => {
      const choice = draftRef.current[p.id];
      return choice === "sheet" || choice === "highlight";
    }).length;
    // Out to sheet is refused when 30 photos already hold a hand-made place: the sheet holds no more.
    if (current === "out" && hand >= SHEET_MAX) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    // The automatic pick is only a starting point: the first edit turns the highlights shown into hand-made choices.
    const untouched = candidatesRef.current.every((p) => draftRef.current[p.id] === undefined);
    const seeded: Record<string, SheetState> = { ...draftRef.current };
    if (untouched) for (const [photoId, state] of Object.entries(shown)) if (state === "highlight") seeded[photoId] = "highlight";
    const choices = { ...seeded, [id]: next };
    draftRef.current = choices;
    setDraft(choices);
  }, []);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const done = () => {
    setSheetChoices(tripId, draft);
    goBack();
  };

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<RevealedPhoto>) => (
      <View style={styles.slot}>
        <SheetPickCell photo={item} token={token} size={size} state={states[item.id] ?? "out"} onPress={onPress} />
      </View>
    ),
    [token, size, states, onPress],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerTransparent: false,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerBlurEffect: "none",
          headerTitle: () => <HeaderTitle subtitle="tocá para destacar, dejar o sacar" />,
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

      {!ready ? (
        <Loading />
      ) : (
        <FlashList
          data={candidates}
          numColumns={COLUMNS}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          extraData={states}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{ paddingHorizontal: edge, paddingTop: GAP / 2, paddingBottom: SHEET_TRAY_HEIGHT + insets.bottom + spacing.sm }}
        />
      )}
      <SheetPickTray counter={counter} bottomInset={insets.bottom} />
    </View>
  );
}

function HeaderTitle({ subtitle }: { subtitle?: string }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={[type.headline, styles.title]}>Elegir fotos</Text>
      {!!subtitle && <Text style={[type.caption, styles.subtitle]}>{subtitle}</Text>}
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
