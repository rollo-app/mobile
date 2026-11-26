// The "Recorrido" half of Compartir: the film's preview, its photos, "Otra versión" and the export to a video.
import * as Burnt from "burnt";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { filmBlocked, filmPhotos, filmStopCount } from "@/features/journey/film-photos";
import { FilmPlayer } from "@/features/journey/film-player";
import { useFilm, type Film } from "@/features/journey/use-film";
import { localDay } from "@/features/capture/quota";
import type { RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";
import { ErrorText, Footnote } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import type { VideoFile } from "../../../modules/rollo-video";
import { exportFilmToFile } from "./film-export";
import { CollageStrip } from "./collage-strip";
import { RetryPill } from "./retry-pill";
import { saveVideo, shareVideoMore, shareVideoToInstagramApp } from "./share-video";
import { VideoPills } from "./share-pills";
import { STORY_RATIO } from "./story-preview";

export type Destination = "instagram" | "save" | "more";
type ReadyFilm = Extract<Film, { status: "ready" }>;
type ExportState = { status: "idle" } | { status: "exporting"; done: number; total: number; destination: Destination };

const IDLE: ExportState = { status: "idle" };
const EXPORT_FAILED = "No se pudo armar el video. Probá de nuevo.";

/**
 * Exports the ready film to a file for a destination and hands the file over. The file belongs to `film.version`: another
 * destination of the same version reuses it. A new version, `cancel()` or unmount stops an export in progress.
 */
export function useFilmExport(
  film: Film,
  tripId: string,
  deliver: (destination: Destination, file: VideoFile, film: ReadyFilm) => Promise<void>,
) {
  const [state, setState] = useState<ExportState>(IDLE);
  const [failed, setFailed] = useState(false);
  const cache = useRef<{ version: string; file: VideoFile } | null>(null);
  const run = useRef<{ cancelled: boolean } | null>(null);
  const last = useRef<Destination>("save");
  const deliverRef = useRef(deliver);
  deliverRef.current = deliver;
  const version = film.status === "ready" ? film.version : null;

  const cancel = useCallback(() => {
    if (run.current) run.current.cancelled = true;
    run.current = null;
    setState(IDLE);
  }, []);

  // A film for another version (or none, or leaving the screen) makes the running export useless.
  useEffect(() => {
    setFailed(false);
    return cancel;
  }, [version, cancel]);

  const start = useCallback(
    async (destination: Destination) => {
      if (film.status !== "ready" || run.current) return;
      last.current = destination;
      setFailed(false);
      const token = { cancelled: false };
      run.current = token;
      try {
        let file = cache.current?.version === film.version ? cache.current.file : null;
        if (!file) {
          setState({ status: "exporting", done: 0, total: 0, destination });
          const made = await exportFilmToFile(film, { tripId }, {
            isCancelled: () => token.cancelled,
            onProgress: (done, total) => {
              if (!token.cancelled) setState({ status: "exporting", done, total, destination });
            },
          });
          if (!made || token.cancelled) return;
          file = made;
          cache.current = { version: film.version, file };
        }
        if (!token.cancelled) setState(IDLE);
        await deliverRef.current(destination, file, film);
      } catch {
        if (!token.cancelled) setFailed(true);
      } finally {
        if (run.current === token) run.current = null;
        if (!token.cancelled) setState(IDLE);
      }
    },
    [film, tripId],
  );

  const retry = useCallback(() => void start(last.current), [start]);
  return { state, failed, start, cancel, retry };
}

const progressText = (done: number, total: number) => `Armando el video… ${total > 0 ? Math.round((done * 100) / total) : 0} %`;

/** The Recorrido body of Compartir. Mounted only while Recorrido is selected, so Collage never loads the map. */
export function JourneyShare({
  tripId,
  detail,
  candidates,
  selection,
  token,
  seed,
  onOtherVersion,
  instagram,
}: {
  tripId: string;
  detail: TripDetail;
  /** `filmCandidates` of the roll. */
  candidates: RevealedPhoto[];
  selection: readonly string[];
  token: string | null;
  seed: number;
  onOtherVersion: () => void;
  instagram: boolean;
}) {
  const [area, setArea] = useState({ width: 0, height: 0 });
  const chosen = useMemo(() => filmPhotos(candidates, selection), [candidates, selection]);
  const { startsAt, timezone } = detail.trip;
  const blocked = filmBlocked(detail, filmStopCount(chosen, localDay(startsAt, timezone)));
  const film = useFilm({ tripId, photos: chosen, token, detail, seed, enabled: blocked === null });

  const [note, setNote] = useState<string | null>(null);
  const deliver = useCallback(async (destination: Destination, file: VideoFile, ready: ReadyFilm) => {
    if (destination === "save") {
      await saveVideo(file.uri);
      Burnt.toast({ title: "Guardado en Fotos", preset: "done" });
    } else if (destination === "more") {
      await shareVideoMore(file.uri);
    } else {
      const route = await shareVideoToInstagramApp(file.uri, ready.durationMs);
      setNote(route === "library" ? ready.version : null);
    }
  }, []);
  const exporter = useFilmExport(film, tripId, deliver);
  const progress = exporter.state.status === "exporting" ? exporter.state : null;
  const exporting = progress !== null;

  // The photos in the order the film shows them once it is built.
  const stripPhotos = useMemo(() => {
    if (film.status !== "ready") return chosen;
    const byId = new Map(chosen.map((p) => [p.id, p]));
    const ordered = film.stops.flatMap((stop) => stop.shots.flatMap((shot) => byId.get(shot.id) ?? []));
    return ordered.length > 0 ? ordered : chosen;
  }, [film, chosen]);

  const onLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) => setArea({ width: layout.width, height: layout.height });
  const previewHeight = Math.max(0, Math.min(area.height, area.width / STORY_RATIO));
  const noRoute = blocked === "no-route" || film.status === "no-route";
  const ready = film.status === "ready" ? film : null;

  return (
    <>
      <View style={styles.previewArea} onLayout={onLayout}>
        {ready && !noRoute ? (
          <FilmPlayer scene={ready.scene} assets={ready.assets} height={previewHeight} playing={!exporting} paused={exporting} />
        ) : (
          <View style={[styles.placeholder, { height: previewHeight, width: previewHeight * STORY_RATIO }]}>
            {film.status === "loading" && !noRoute && (
              <>
                <ActivityIndicator accessibilityLabel="Armando el recorrido" />
                <Text style={[type.footnote, styles.loadingText]}>Armando el recorrido…</Text>
              </>
            )}
          </View>
        )}
      </View>
      <CollageStrip
        photos={stripPhotos}
        token={token}
        subject="recorrido"
        onPress={candidates.length >= 2 ? () => router.push({ pathname: "/share-pick", params: { tripId, kind: "journey" } }) : null}
      />
      {noRoute && <Footnote>Con estas fotos no hay recorrido: elegí fotos de al menos dos lugares.</Footnote>}
      {!noRoute && film.status === "error" && (
        <View style={styles.failure}>
          <ErrorText>{film.offline ? "Para armar el recorrido hace falta conexión." : "No se pudo armar el recorrido. Probá de nuevo."}</ErrorText>
          <RetryPill onPress={film.retry} />
        </View>
      )}
      {ready && !noRoute && (
        <>
          {progress ? (
            <View style={styles.progress}>
              <Text style={[type.footnote, styles.progressText]}>{progressText(progress.done, progress.total)}</Text>
              <Pressable testID="film-cancel" accessibilityRole="button" accessibilityLabel="Cancelar" onPress={exporter.cancel} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
                <Text style={[type.footnote, styles.cancelText]}>Cancelar</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable accessibilityRole="button" accessibilityLabel="Otra versión" onPress={onOtherVersion} style={({ pressed }) => [styles.other, pressed && styles.pressed]}>
                <Text style={[type.footnote, styles.otherText]}>Otra versión</Text>
              </Pressable>
              <VideoPills
                instagram={instagram}
                onInstagram={() => void exporter.start("instagram")}
                onSave={() => void exporter.start("save")}
                onMore={() => void exporter.start("more")}
              />
            </>
          )}
          {!exporting && note === ready.version && <Text style={[type.caption, styles.hint]}>Lo guardamos en tus fotos. Elegilo en tu historia.</Text>}
          {!exporting && exporter.failed && (
            <View style={styles.failureInline}>
              <ErrorText>{EXPORT_FAILED}</ErrorText>
              <RetryPill onPress={exporter.retry} />
            </View>
          )}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  previewArea: { flex: 1, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  placeholder: { alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: 12, backgroundColor: colors.latent },
  loadingText: { color: colors.secondaryLabel },
  failure: { alignItems: "center", gap: spacing.md },
  failureInline: { alignItems: "center", gap: spacing.sm },
  progress: { alignItems: "center", gap: spacing.sm },
  progressText: { color: colors.secondaryLabel, fontVariant: ["tabular-nums"] },
  cancel: { height: 40, paddingHorizontal: 18, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.fill },
  cancelText: { fontWeight: "600", color: colors.label },
  other: { alignSelf: "center", paddingVertical: 4, paddingHorizontal: 8 },
  otherText: { fontWeight: "600", color: colors.tint },
  hint: { color: colors.secondaryLabel, textAlign: "center" },
  pressed: { opacity: 0.6 },
});
