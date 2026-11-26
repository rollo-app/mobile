import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { useRevealedPhotos } from "@/features/media/revealed";
import { shareKind, type ShareKind } from "@/features/share/share-options";
import { SelectionHeaderTitle } from "@/features/gallery/selection-header-title";
import { View, type ColorValue } from "react-native";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useRollPhase } from "@/features/trips/use-roll-phase";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { setActiveTripId } from "@/storage/active-trip";
import { Button, ErrorText, Loading, Screen } from "@/ui/components";
import { SHARE_ICON } from "@/ui/share-icon";
import { colors, spacing } from "@/ui/theme";
import { RevealedRollScreen } from "./revealed-roll-screen";
import { RollViewSwitch } from "./roll-view-switch";
import { RollBoard } from "./roll-board";

/** A roll's own screen: before the reveal the board, after it "Galería | Rollo". */
export function RollScreen({ tripId, view }: { tripId: string; view?: string }) {
  const { trips, loaded, refetch } = useActiveTrip();
  const trip = trips.find((t) => t.id === tripId);
  const { detail } = useTripDetail(tripId);
  const phase = useRollPhase(detail);
  // Only a revealed roll needs the photos (for the collage); the revealed screen already caches them: no extra requests.
  const { photos } = useRevealedPhotos(trip && phase === "revealed" ? trip.id : undefined);
  // While the gallery is selecting, the title is the selection: the trip's name doesn't fit between its two buttons.
  const [selection, setSelection] = useState<number | null>(null);
  // Opening a roll makes it the active one (capture, map and feed follow it).
  useEffect(() => {
    void setActiveTripId(tripId);
  }, [tripId]);
  // A roll that isn't in the list may just be newer than the cached list (created or joined a moment ago):
  // refetch the list once, and only go back to /roll if it's still missing after a successful fetch.
  const [lookup, setLookup] = useState<"idle" | "checking" | "missing" | "failed">("idle");
  const absent = loaded && !trip;
  useEffect(() => {
    if (!absent || lookup !== "idle") return;
    setLookup("checking");
    void refetch().then((result) => {
      if (result.isError || !result.data) setLookup("failed");
      else setLookup(result.data.trips.some((t) => t.id === tripId) ? "idle" : "missing");
    });
  }, [absent, lookup, refetch, tripId]);
  useEffect(() => {
    if (absent && lookup === "missing") router.replace("/roll");
  }, [absent, lookup]);
  const revealed = trip && phase === "revealed";
  const kind = detail ? shareKind(detail, photos) : null;
  const selecting = revealed && view !== "roll" && selection !== null;
  // Revealed, the header is solid with the screen's background so it reads as one block with the
  // "Galería | Rollo" row under it. Set here (not in the revealed screen) so that switching to a trip
  // that isn't revealed clears them: undefined goes back to the stack's default header.
  const header = revealed ? solidHeader(view === "roll" ? colors.groupedBackground : colors.background) : defaultHeader;
  return (
    <>
      {trip && (
        <Stack.Screen
          options={{
            ...header,
            title: trip.name,
            // Revealed: "Galería | Rollo" is the bar's title (the name is large in the content; `title` stays for
            // the back button and VoiceOver). While selecting, the count takes its place.
            headerTitle: selecting
              ? () => <SelectionHeaderTitle count={selection} />
              : revealed
                ? () => <RollViewSwitch view={view} />
                : undefined,
          }}
        />
      )}
      {/* "Compartir" and "Ajustes del rollo": on the board and in the revealed "Rollo" view; the gallery has its own toolbar. */}
      {trip && (!revealed || view === "roll") && <RollToolbar tripId={trip.id} kind={kind} />}
      {absent ? (
        <Screen grouped>
          {lookup === "failed" ? (
            <View testID="roll-lookup-error" style={{ gap: spacing.md }}>
              <ErrorText>No se pudo cargar tu lista de rollos</ErrorText>
              <Button label="Reintentar" variant="secondary" onPress={() => setLookup("idle")} />
            </View>
          ) : (
            <Loading />
          )}
        </Screen>
      ) : revealed ? (
        <RevealedRollScreen
          tripId={tripId}
          onSelectionChange={setSelection}
          onShare={kind ? () => router.push({ pathname: "/share-story", params: { tripId, kind } }) : undefined}
        />
      ) : (
        <RollBoard tripId={tripId} />
      )}
    </>
  );
}

function RollToolbar({ tripId, kind }: { tripId: string; kind: ShareKind | null }) {
  return (
    <Stack.Toolbar placement="right">
      {/* Direct children only: the header drops Fragments (see GalleryToolbar). */}
      {kind && (
        <Stack.Toolbar.Button
          icon={SHARE_ICON}
          iconRenderingMode="template"
          accessibilityLabel="Compartir"
          onPress={() => router.push({ pathname: "/share-story", params: { tripId, kind } })}
        />
      )}
      <Stack.Toolbar.Button
        icon="gearshape"
        accessibilityLabel="Ajustes del rollo"
        onPress={() => router.push({ pathname: "/roll-settings", params: { tripId } })}
      />
    </Stack.Toolbar>
  );
}

const solidHeader = (backgroundColor: ColorValue) => ({
  headerTransparent: false,
  headerStyle: { backgroundColor },
  headerShadowVisible: false,
  headerBlurEffect: "none" as const,
  headerLargeTitle: false,
});

const defaultHeader = {
  headerTransparent: undefined,
  headerStyle: undefined,
  headerShadowVisible: undefined,
  headerBlurEffect: undefined,
  headerLargeTitle: undefined,
};
