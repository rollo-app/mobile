// The video half of Compartir ("Recorrido" or "Resumen"): the film's preview, its photos and the export to a video. The arrangement is random (the screen draws one seed per visit) and not the user's to choose.
import * as Burnt from "burnt";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { sheetCounter } from "@/features/journey/sheet/sheet-photos";
import { filmBlocked, filmPhotos, filmStopCount } from "@/features/journey/film-photos";
import { FilmPlayer } from "@/features/journey/film-player";
import { useFilm, type Film } from "@/features/journey/use-film";
import { useSheetFilm, type SheetFilm } from "@/features/journey/use-sheet-film";
import { localDay } from "@/features/capture/quota";
import type { RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";
import { ErrorText, Footnote } from "@/ui/components";
import { PermissionNotice } from "@/features/gallery/permission-notice";
import { PermissionDeniedError } from "@/features/gallery/save";
import { colors, spacing, type } from "@/ui/theme";
import type { VideoFile } from "../../../modules/rollo-video";
import { exportFilmToFile } from "./film-export";
import { CollageStrip } from "./collage-strip";
import { setFilmShown } from "./film-selection";
import { RetryPill } from "./retry-pill";
import { saveVideo, shareVideoMore, shareVideoToInstagramApp } from "./share-video";
import { VideoPills } from "./share-pills";
import { STORY_RATIO } from "./story-preview";

export type Destination = "instagram" | "save" | "more";
type AnyFilmState = Film | SheetFilm;
type ReadyFilm = Extract<AnyFilmState, { status: "ready" }>;
type ExportState = { status: "idle" } | { status: "exporting"; done: number; total: number; destination: Destination };

const IDLE: ExportState = { status: "idle" };
const EXPORT_FAILED = "No se pudo armar el video. Probá de nuevo.";

/**
 * Exports the ready film to a file for a destination and hands the file over. The file belongs to `film.version`: another
 * destination of the same version reuses it. A new version, `cancel()` or unmount stops an export in progress.
 */
export function useFilmExport(
  film: AnyFilmState,
  tripId: string,
  deliver: (destination: Destination, file: VideoFile, film: ReadyFilm) => Promise<void>,
) {
  const [state, setState] = useState<ExportState>(IDLE);
  const [failed, setFailed] = useState<"failed" | "denied" | null>(null);
  // Settles when the previous run is completely over (the encoder released): a new `open` must not start before it.
  const settled = useRef<Promise<void>>(Promise.resolve());
  const cache = useRef<{ version: string; file: VideoFile } | null>(null);
  const run = useRef<{ cancelled: boolean } | null>(null);
  const last = useRef<Destination>("save");
  const deliverRef = useRef(deliver);
  deliverRef.current = deliver;
  const version = film.status === "ready" ? film.film.version : null;

  const cancel = useCallback(() => {
    if (run.current) run.current.cancelled = true;
    run.current = null;
    setState(IDLE);
  }, []);

  // A film for another version (or none, or leaving the screen) makes the running export useless.
  useEffect(() => {
    setFailed(null);
    // Every version writes to the same path and the native `open` deletes what is there: a file of another version is gone.
    cache.current = null;
    return cancel;
  }, [version, cancel]);

  const start = useCallback(
    async (destination: Destination) => {
      if (film.status !== "ready" || run.current) return;
      last.current = destination;
      setFailed(null);
      const token = { cancelled: false };
      run.current = token;
      const previous = settled.current;
      let release!: () => void;
      settled.current = new Promise<void>((resolve) => (release = resolve));
      try {
        let file = cache.current?.version === film.film.version ? cache.current.file : null;
        if (!file) {
          cache.current = null;
          setState({ status: "exporting", done: 0, total: 0, destination });
          await previous;
          // The player must be paused on screen before this thread starts drawing the same scene: wait for the commit and a UI frame.
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined))));
          if (token.cancelled) return;
          const made = await exportFilmToFile(film.film, { tripId }, {
            isCancelled: () => token.cancelled,
            onProgress: (done, total) => {
              if (!token.cancelled) setState({ status: "exporting", done, total, destination });
            },
          });
          if (!made || token.cancelled) return;
          file = made;
          cache.current = { version: film.film.version, file };
        }
        if (!token.cancelled) setState(IDLE);
        await deliverRef.current(destination, file, film);
      } catch (error) {
        if (!token.cancelled) setFailed(error instanceof PermissionDeniedError ? "denied" : "failed");
      } finally {
        release();
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

type FilmShareBase = {
  tripId: string;
  detail: TripDetail;
  token: string | null;
  seed: number;
  instagram: boolean;
};

export type FilmShareProps = FilmShareBase &
  (
    | { kind: "route"; /** `filmCandidates` of the roll. */ candidates: RevealedPhoto[]; selection: readonly string[] }
    | { kind: "sheet"; /** `sheetPick` of the roll. */ pick: { cells: RevealedPhoto[]; highlights: string[] } }
  );

/** The video body of Compartir. Mounted only while its segment is selected, so Collage never loads the map or the photos. */
export function FilmShare(props: FilmShareProps) {
  return props.kind === "route" ? <RouteFilmShare {...props} /> : <SheetFilmShare {...props} />;
}

function RouteFilmShare({ tripId, detail, candidates, selection, token, seed, instagram }: FilmShareBase & { candidates: RevealedPhoto[]; selection: readonly string[] }) {
  const chosen = useMemo(() => filmPhotos(candidates, selection), [candidates, selection]);
  const { startsAt, timezone } = detail.trip;
  const stops = useMemo(() => filmStopCount(chosen, localDay(startsAt, timezone)), [chosen, startsAt, timezone]);
  const blocked = filmBlocked(detail, stops);
  const film = useFilm({ tripId, photos: chosen, token, detail, seed, enabled: blocked === null });
  const noRoute = blocked === "no-route" || film.status === "no-route";

  // The photos in the order the film shows them once it is built.
  const stripPhotos = useMemo(() => {
    if (film.status !== "ready") return chosen;
    const byId = new Map(chosen.map((p) => [p.id, p]));
    const ordered = film.stops.flatMap((stop) => stop.shots.flatMap((shot) => byId.get(shot.id) ?? []));
    return ordered.length > 0 ? ordered : chosen;
  }, [film, chosen]);

  const onAdd =
    candidates.length >= 2
      ? () => {
          // The picker starts from what the film is made of now.
          setFilmShown(tripId, stripPhotos.map((p) => p.id));
          router.push({ pathname: "/share-pick", params: { tripId, kind: "journey" } });
        }
      : null;

  return (
    <FilmBody
      tripId={tripId}
      token={token}
      instagram={instagram}
      film={film}
      stripPhotos={stripPhotos}
      subject="recorrido"
      onAdd={onAdd}
      notice={noRoute ? "Con estas fotos no hay recorrido: elegí fotos de al menos dos lugares." : null}
      texts={{ loading: "Armando el recorrido", offline: "Para armar el recorrido hace falta conexión.", failed: "No se pudo armar el recorrido. Probá de nuevo." }}
    />
  );
}

function SheetFilmShare({ tripId, detail, pick, token, seed, instagram }: FilmShareBase & { pick: { cells: RevealedPhoto[]; highlights: string[] } }) {
  const film = useSheetFilm({ tripId, cells: pick.cells, highlights: pick.highlights, token, detail, seed, enabled: true });
  // The highlighted photos in time order, or the first of the sheet when there are none.
  const stripPhotos = useMemo(() => {
    const marked = new Set(pick.highlights);
    const highlighted = pick.cells.filter((p) => marked.has(p.id));
    return highlighted.length > 0 ? highlighted : pick.cells;
  }, [pick]);
  const counter = useMemo(() => sheetCounter(pick), [pick]);

  return (
    <FilmBody
      tripId={tripId}
      token={token}
      instagram={instagram}
      film={film}
      stripPhotos={stripPhotos}
      stripTotal={pick.cells.length}
      subject="resumen"
      counter={counter}
      onAdd={() => router.push({ pathname: "/share-pick", params: { tripId, kind: "sheet" } })}
      notice={film.status === "few" ? "Faltan fotos para el resumen: dejá al menos 6 en la hoja." : null}
      texts={{ loading: "Armando el resumen", offline: null, failed: "No se pudo armar el resumen. Probá de nuevo." }}
    />
  );
}

/** What both films share: the preview, the strip, the export to a video and its destinations. `notice` replaces the player and the pills. */
function FilmBody({
  tripId,
  token,
  instagram,
  film,
  stripPhotos,
  stripTotal,
  subject,
  counter,
  onAdd,
  notice,
  texts,
}: {
  tripId: string;
  token: string | null;
  instagram: boolean;
  film: AnyFilmState;
  stripPhotos: RevealedPhoto[];
  /** What the strip's hint says the film has, when that is not the strip's own photos (the summary: its whole sheet). */
  stripTotal?: number;
  subject: "recorrido" | "resumen";
  counter?: string;
  onAdd: (() => void) | null;
  notice: string | null;
  texts: { loading: string; offline: string | null; failed: string };
}) {
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [note, setNote] = useState<string | null>(null);
  const deliver = useCallback(async (destination: Destination, file: VideoFile, ready: ReadyFilm) => {
    if (destination === "save") {
      await saveVideo(file.uri);
      Burnt.toast({ title: "Guardado en Fotos", preset: "done" });
    } else if (destination === "more") {
      await shareVideoMore(file.uri);
    } else {
      const route = await shareVideoToInstagramApp(file.uri, ready.film.durationMs);
      setNote(route === "library" ? ready.film.version : null);
    }
  }, []);
  const exporter = useFilmExport(film, tripId, deliver);
  const progress = exporter.state.status === "exporting" ? exporter.state : null;
  const exporting = progress !== null;

  const onLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) => setArea({ width: layout.width, height: layout.height });
  const previewHeight = Math.max(0, Math.min(area.height, area.width / STORY_RATIO));
  const ready = film.status === "ready" && notice === null ? film : null;

  return (
    <>
      <View style={styles.previewArea} onLayout={onLayout}>
        {ready ? (
          <FilmPlayer film={ready.film} height={previewHeight} playing={!exporting} paused={exporting} />
        ) : (
          <View style={[styles.placeholder, { height: previewHeight, width: previewHeight * STORY_RATIO }]}>
            {film.status === "loading" && notice === null && (
              <>
                <ActivityIndicator accessibilityLabel={texts.loading} />
                <Text style={[type.footnote, styles.loadingText]}>
                  {film.total > 0 ? `${texts.loading}… ${Math.round((film.done * 100) / film.total)} %` : `${texts.loading}…`}
                </Text>
              </>
            )}
          </View>
        )}
      </View>
      {!!counter && <Text style={[type.footnote, styles.counter]}>{counter}</Text>}
      <CollageStrip photos={stripPhotos} total={stripTotal} token={token} subject={subject} onPress={onAdd} />
      {!!notice && <Footnote>{notice}</Footnote>}
      {notice === null && film.status === "error" && (
        <View style={styles.failure}>
          <ErrorText>{film.offline && texts.offline ? texts.offline : texts.failed}</ErrorText>
          <RetryPill onPress={film.retry} />
        </View>
      )}
      {ready && (
        <>
          {progress ? (
            <View style={styles.progress}>
              <Text style={[type.footnote, styles.progressText]}>{progressText(progress.done, progress.total)}</Text>
              <Pressable testID="film-cancel" accessibilityRole="button" accessibilityLabel="Cancelar" onPress={exporter.cancel} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
                <Text style={[type.footnote, styles.cancelText]}>Cancelar</Text>
              </Pressable>
            </View>
          ) : (
            <VideoPills
              instagram={instagram}
              onInstagram={() => void exporter.start("instagram")}
              onSave={() => void exporter.start("save")}
              onMore={() => void exporter.start("more")}
            />
          )}
          {!exporting && note === ready.film.version && <Text style={[type.caption, styles.hint]}>Lo guardamos en tus fotos. Elegilo en tu historia.</Text>}
          {!exporting && exporter.failed === "denied" && <PermissionNotice />}
          {!exporting && exporter.failed === "failed" && (
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
  counter: { color: colors.secondaryLabel, textAlign: "center" },
  hint: { color: colors.secondaryLabel, textAlign: "center" },
  pressed: { opacity: 0.6 },
});
