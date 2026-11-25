import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { router, Stack } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type RevealedPhoto, useRevealedPhotos } from "@/features/media/revealed";
import { Loading } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { COLLAGE_MAX, collageCandidates } from "./collage";
import { getCollageSelection, setCollageSelection, toggleSelection } from "./collage-selection";
import { PickCell } from "./pick-cell";

const COLUMNS = 3;
const GAP = 2;

const keyExtractor = (photo: RevealedPhoto) => photo.id;

/** "Elegir fotos": pick up to 8 shareable photos for the collage; the tap order is the collage order (1 is the big photo). */
export function SharePickScreen({ tripId }: { tripId: string }) {
  const { photos, token, complete, loading } = useRevealedPhotos(tripId);
  const candidates = useMemo(() => collageCandidates(photos), [photos]);
  const [draft, setDraft] = useState<string[]>(() => [...getCollageSelection(tripId)]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const size = Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS);
  const full = draft.length >= COLLAGE_MAX;

  const onPress = useCallback((id: string) => {
    setDraft((current) => {
      const result = toggleSelection(current, id);
      if (result.full) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return result.full ? current : result.selection;
    });
  }, []);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const done = () => {
    setCollageSelection(tripId, draft);
    goBack();
  };

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<RevealedPhoto>) => {
      const index = draft.indexOf(item.id);
      return (
        <View style={styles.slot}>
          <PickCell photo={item} token={token} size={size} order={index >= 0 ? index + 1 : null} dimmed={full && index < 0} onPress={onPress} />
        </View>
      );
    },
    [draft, token, size, full, onPress],
  );

  return (
    <View style={styles.screen}>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={goBack}>Cancelar</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button variant="done" onPress={done}>
          Listo
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Text style={[type.subhead, styles.counter]}>{`${draft.length} de ${COLLAGE_MAX}`}</Text>
      {!complete && loading ? (
        <Loading />
      ) : (
        <FlashList
          data={candidates}
          numColumns={COLUMNS}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          extraData={draft}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.md }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  counter: { color: colors.secondaryLabel, textAlign: "center", paddingVertical: spacing.sm, fontVariant: ["tabular-nums"] },
  // Same trick as the gallery: the cell hugs the edges, leaving GAP between neighbours.
  slot: { alignItems: "center", paddingBottom: GAP },
});
