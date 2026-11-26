import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { type ReactNode, useMemo, useState } from "react";
import { ActivityIndicator, type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { filmBlocked, filmCandidates, filmPhotos, filmStopCount } from "@/features/journey/film-photos";
import { FilmPlayer } from "@/features/journey/film-player";
import { sheetCandidates, sheetPick } from "@/features/journey/sheet/sheet-photos";
import { useFilm } from "@/features/journey/use-film";
import { useSheetFilm } from "@/features/journey/use-sheet-film";
import { localDay } from "@/features/capture/quota";
import { useRevealedPhotos, type RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { colors, radius, spacing, type } from "@/ui/theme";
import { useFilmSelection } from "./film-selection";
import type { RollVideoKind } from "./roll-videos";
import { useSheetChoices } from "./sheet-selection";
import { STORY_RATIO } from "./story-preview";
import { useRollVideos } from "./use-roll-videos";

const NO_VIDEO = "Este rollo todavía no tiene video.";
const FAILED = "No se pudo armar el video.";
const OFFLINE = "Sin conexión no se puede armar el video.";

type StageState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "error"; offline: boolean; retry: () => void }
  | { status: "ready"; film: Parameters<typeof FilmPlayer>[0]["film"] };

const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

/** The roll's video, full screen: the film of `kind` scaled to the screen, with close and share. Builds it with the same hooks and defaults as Compartir. */
export function RollVideoScreen({ tripId, kind }: { tripId: string; kind: string }) {
  const { detail, error: detailError, refetch: refetchDetail } = useTripDetail(tripId);
  const { photos, token, complete, error: feedError, refetch: refetchFeed } = useRevealedPhotos(tripId);
  // Drawn once per visit, as in Compartir.
  const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff) + 1);
  const videos = useRollVideos({ detail, photos, ready: complete, feedFailed: !!feedError });
  const known = kind === "route" || kind === "sheet";

  let body: ReactNode;
  if (!known) body = <Stage stage={{ status: "none" }} kind="route" />;
  else if (detailError || feedError)
    body = <Stage stage={{ status: "error", offline: false, retry: () => void Promise.all([refetchDetail(), refetchFeed()]) }} kind={kind} tripId={tripId} />;
  else if (detail === null || !complete) body = <Stage stage={{ status: "loading" }} kind={kind} tripId={tripId} />;
  else if (!videos.includes(kind)) body = <Stage stage={{ status: "none" }} kind={kind} tripId={tripId} />;
  else if (kind === "route") body = <RouteStage tripId={tripId} detail={detail} photos={photos} token={token} seed={seed} />;
  else body = <SheetStage tripId={tripId} detail={detail} photos={photos} token={token} seed={seed} />;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {body}
    </View>
  );
}

type StageArgs = { tripId: string; detail: TripDetail; photos: RevealedPhoto[]; token: string | null; seed: number };

function RouteStage({ tripId, detail, photos, token, seed }: StageArgs) {
  const selection = useFilmSelection(tripId);
  const chosen = useMemo(() => filmPhotos(filmCandidates(photos), selection), [photos, selection]);
  const { startsAt, timezone } = detail.trip;
  const stops = useMemo(() => filmStopCount(chosen, localDay(startsAt, timezone)), [chosen, startsAt, timezone]);
  const blocked = filmBlocked(detail, stops);
  const film = useFilm({ tripId, photos: chosen, token, detail, seed, enabled: blocked === null });
  if (blocked !== null || film.status === "no-route") return <Stage stage={{ status: "none" }} kind="route" tripId={tripId} />;
  return <Stage stage={film.status === "ready" ? { status: "ready", film: film.film } : film} kind="route" tripId={tripId} />;
}

function SheetStage({ tripId, detail, photos, token, seed }: StageArgs) {
  const choices = useSheetChoices(tripId);
  const pick = useMemo(() => sheetPick(sheetCandidates(photos), choices), [photos, choices]);
  const film = useSheetFilm({ tripId, cells: pick.cells, highlights: pick.highlights, token, detail, seed, enabled: true });
  if (film.status === "few") return <Stage stage={{ status: "none" }} kind="sheet" tripId={tripId} />;
  return <Stage stage={film.status === "ready" ? { status: "ready", film: film.film } : film} kind="sheet" tripId={tripId} />;
}

/** What the screen draws for a stage; `film` stages are the hooks' own states, so a loading one carries progress we don't show. */
function Stage({ stage, kind, tripId }: { stage: StageState | { status: "loading"; done: number; total: number }; kind: RollVideoKind; tripId?: string }) {
  const insets = useSafeAreaInsets();
  const [area, setArea] = useState({ width: 0, height: 0 });
  const height = Math.max(0, Math.min(area.height, area.width / STORY_RATIO));
  const onLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) => setArea({ width: layout.width, height: layout.height });
  const share = () => router.replace({ pathname: "/share-story", params: { tripId, kind: kind === "route" ? "journey" : "sheet" } });

  if (stage.status === "ready")
    return (
      <>
        {/* The film fits what the safe areas leave, at 9:16, centered. */}
        <View style={[styles.area, { paddingTop: insets.top, paddingBottom: insets.bottom }]} onLayout={onLayout}>
          <FilmPlayer film={stage.film} height={height} playing paused={false} />
        </View>
        <CloseButton top={insets.top} />
        <View pointerEvents="box-none" style={[styles.bottom, { bottom: Math.max(insets.bottom, spacing.md) + spacing.md }]}>
          <Pill label="Compartir" primary onPress={share} />
        </View>
      </>
    );

  return (
    <View style={styles.center}>
      {stage.status === "loading" && <ActivityIndicator color="#FFFFFF" accessibilityLabel="Armando el video" />}
      {stage.status === "none" && (
        <>
          <Text style={[type.body, styles.message]}>{NO_VIDEO}</Text>
          <Pill label="Cerrar" onPress={close} />
        </>
      )}
      {stage.status === "error" && (
        <>
          <Text style={[type.body, styles.message]}>{stage.offline ? OFFLINE : FAILED}</Text>
          <Pill label="Reintentar" onPress={stage.retry} />
        </>
      )}
      {stage.status === "error" && <CloseButton top={insets.top} />}
    </View>
  );
}

function CloseButton({ top }: { top: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={4} onPress={close} style={[styles.close, { top: top + spacing.sm }]}>
      <SymbolView name="xmark" size={16} weight="semibold" tintColor="#FFFFFF" />
    </Pressable>
  );
}

function Pill({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, primary ? styles.pillPrimary : styles.pillSecondary, pressed && styles.pressed]}
    >
      <Text style={[type.headline, primary ? styles.pillLabelPrimary : styles.pillLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  area: { flex: 1, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg },
  message: { color: "#FFFFFF", textAlign: "center" },
  close: { position: "absolute", right: spacing.md, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)" },
  bottom: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  pill: { minHeight: 50, minWidth: 160, borderRadius: radius.full, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  pillPrimary: { backgroundColor: colors.tint },
  pillSecondary: { backgroundColor: "rgba(255,255,255,0.18)" },
  pillLabel: { color: "#FFFFFF" },
  pillLabelPrimary: { color: colors.onTint },
  pressed: { opacity: 0.7 },
});
