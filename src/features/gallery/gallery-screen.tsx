import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mediaSource, useRevealedPhotos, type RevealedPhoto } from "@/features/media/revealed";
import { TripSwitcher } from "@/features/trips/trip-switcher";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { authorsOf, chunkRows, filterByAuthor, groupByDay } from "./group";
import { PermissionNotice } from "./permission-notice";
import { downloadAll, estimateBytes, formatMegabytes, PermissionDeniedError } from "./save";
import { useSaver } from "./use-saver";

const COLUMNS = 3;
const GAP = 2;

type Bar =
  | { kind: "progress"; done: number; total: number }
  | { kind: "result"; saved: number; failed: RevealedPhoto[]; cancelled: boolean }
  | { kind: "denied" };

const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

const Cell = memo(function Cell({
  photo,
  token,
  size,
  selecting,
  selected,
  onPress,
}: {
  photo: RevealedPhoto;
  token: string | null;
  size: number;
  selecting: boolean;
  selected: boolean;
  onPress: (photo: RevealedPhoto) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${photo.type === "video" ? "Video" : "Foto"} de ${photo.author.name}`}
      accessibilityState={selecting ? { selected } : undefined}
      onPress={() => onPress(photo)}
      style={{ width: size, height: size, backgroundColor: colors.latent }}
    >
      {token && (
        <Image
          source={mediaSource(photo.thumbPath, token)}
          placeholder={photo.thumbhash ? { thumbhash: photo.thumbhash } : undefined}
          transition={120}
          contentFit="cover"
          recyclingKey={photo.id}
          style={StyleSheet.absoluteFill}
        />
      )}
      {photo.type === "video" && (
        <View style={styles.video}>
          <SymbolView name="play.fill" size={10} tintColor="#FFFFFF" />
          {photo.durationS !== null && <Text style={[type.caption, styles.videoText]}>{formatDuration(photo.durationS)}</Text>}
        </View>
      )}
      {selecting && (
        <View style={[styles.check, selected && { backgroundColor: colors.tint, borderColor: colors.tint }]}>
          {selected && <SymbolView name="checkmark" size={12} weight="bold" tintColor={colors.onTint as string} />}
        </View>
      )}
    </Pressable>
  );
});

/** Revealed roll: grid grouped by day, filter by person, and downloads to Photos. */
export function GalleryScreen({ tripId }: { tripId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { photos, token, error, loading, refetch } = useRevealedPhotos(tripId);
  const { trip } = useActiveTrip();
  const { detail } = useTripDetail(tripId);
  const saver = useSaver(token, detail?.trip.name);

  const [authorId, setAuthorId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bar, setBar] = useState<Bar | null>(null);
  const abort = useRef<AbortController | null>(null);

  const size = Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS);
  const authors = useMemo(() => authorsOf(photos), [photos]);
  const shown = useMemo(() => filterByAuthor(photos, authorId), [photos, authorId]);
  const sections = useMemo(
    () => groupByDay(shown).map((s) => ({ title: s.title, data: chunkRows(s.photos, COLUMNS) })),
    [shown],
  );
  const author = authors.find((a) => a.id === authorId);

  const onCellPress = useCallback(
    (photo: RevealedPhoto) => {
      if (selecting) {
        setSelected((prev) => {
          const next = new Set(prev);
          if (!next.delete(photo.id)) next.add(photo.id);
          return next;
        });
      } else {
        router.push({ pathname: "/photo/[id]", params: { id: photo.id, tripId } });
      }
    },
    [selecting, router, tripId],
  );

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  async function run(list: RevealedPhoto[]) {
    if (!saver || list.length === 0) return;
    const controller = new AbortController();
    abort.current = controller;
    setBar({ kind: "progress", done: 0, total: list.length });
    try {
      const result = await downloadAll(list, saver, {
        signal: controller.signal,
        onProgress: (done, total) => setBar({ kind: "progress", done, total }),
      });
      setBar({ kind: "result", saved: result.saved, failed: result.failed, cancelled: result.cancelled });
      if (result.saved > 0 && result.failed.length === 0) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      stopSelecting();
    } catch (e) {
      if (e instanceof PermissionDeniedError) setBar({ kind: "denied" });
      else setBar(null);
    } finally {
      abort.current = null;
    }
  }

  function confirmSaveAll() {
    Alert.alert(
      `Guardar ${photos.length} ${photos.length === 1 ? "foto" : "fotos"} en Fotos`,
      `Ocupa ~${formatMegabytes(estimateBytes(photos))}. Conviene Wi-Fi.`,
      [{ text: "Cancelar", style: "cancel" }, { text: "Guardar", onPress: () => void run(photos) }],
    );
  }

  const busy = bar?.kind === "progress";
  const canSaveAll = !busy && !!saver && photos.length > 0;

  const toolbar = (
    <Stack.Toolbar placement="right">
      {selecting ? (
        <Stack.Toolbar.Button onPress={stopSelecting}>Cancelar</Stack.Toolbar.Button>
      ) : (
        <>
          <Stack.Toolbar.Button disabled={busy || photos.length === 0} onPress={() => setSelecting(true)}>
            Seleccionar
          </Stack.Toolbar.Button>
          <Stack.Toolbar.Menu icon="ellipsis.circle" accessibilityLabel="Más opciones">
            <Stack.Toolbar.Menu title="Filtrar por persona" icon="person.2">
              <Stack.Toolbar.MenuAction isOn={authorId === null} onPress={() => setAuthorId(null)}>
                Todos
              </Stack.Toolbar.MenuAction>
              {authors.map((a) => (
                <Stack.Toolbar.MenuAction key={a.id} isOn={authorId === a.id} onPress={() => setAuthorId(a.id)}>
                  {a.name}
                </Stack.Toolbar.MenuAction>
              ))}
            </Stack.Toolbar.Menu>
            <Stack.Toolbar.MenuAction icon="square.and.arrow.down" disabled={!canSaveAll} onPress={confirmSaveAll}>
              Guardar todo en Fotos
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </>
      )}
    </Stack.Toolbar>
  );

  let body;
  if (loading) body = <ActivityIndicator style={{ marginTop: spacing.xl }} />;
  else if (error && photos.length === 0)
    body = (
      <View style={styles.center}>
        <ErrorText>{error}</ErrorText>
        <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} />
      </View>
    );
  else if (photos.length === 0)
    body = (
      <View style={styles.center}>
        <Text style={[type.body, { color: colors.secondaryLabel }]}>Este rollo no tiene fotos</Text>
      </View>
    );
  else
    body = (
      <SectionList
        testID="gallery-list"
        sections={sections}
        keyExtractor={(row) => row[0]!.id}
        stickySectionHeadersEnabled={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        extraData={[selecting, selected, token]}
        ListHeaderComponent={
          author ? (
            <View style={styles.filter}>
              <Text style={[type.subhead, { color: colors.secondaryLabel }]}>{`Solo ${author.name}`}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Quitar filtro" hitSlop={10} onPress={() => setAuthorId(null)}>
                <SymbolView name="xmark.circle.fill" size={18} tintColor={colors.tint as string} />
              </Pressable>
            </View>
          ) : undefined
        }
        renderSectionHeader={({ section }) => (
          <Text accessibilityRole="header" style={[type.headline, styles.header]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item: row }) => (
          <View style={styles.row}>
            {row.map((photo) => (
              <Cell
                key={photo.id}
                photo={photo}
                token={token}
                size={size}
                selecting={selecting}
                selected={selected.has(photo.id)}
                onPress={onCellPress}
              />
            ))}
          </View>
        )}
        ListEmptyComponent={
          <Text style={[type.body, styles.empty]}>{author ? `${author.name} no sacó fotos` : "Este rollo no tiene fotos"}</Text>
        }
      />
    );

  return (
    <View style={styles.fill}>
      {trip && <Stack.Screen options={{ headerTitle: () => <TripSwitcher name={trip.tripName} /> }} />}
      {toolbar}
      {body}
      {(bar || selecting) && (
        <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.sm }]}>
          {bar?.kind === "progress" ? (
            <>
              <View style={styles.barRow}>
                <Text style={[type.subhead, { color: colors.label }]}>{`Guardando ${Math.min(bar.done + 1, bar.total)} de ${bar.total}`}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Cancelar descarga" onPress={() => abort.current?.abort()}>
                  <Text style={[type.subhead, styles.action]}>Cancelar</Text>
                </Pressable>
              </View>
              <View style={styles.track}>
                <View style={[styles.fillBar, { width: `${(bar.done / bar.total) * 100}%` }]} />
              </View>
            </>
          ) : bar?.kind === "denied" ? (
            <View style={styles.barRow}>
              <PermissionNotice />
            </View>
          ) : bar?.kind === "result" ? (
            <View style={styles.barRow}>
              <Text style={[type.subhead, { color: colors.label, flex: 1 }]}>
                {resultText(bar)}
              </Text>
              {bar.failed.length > 0 && (
                <Pressable accessibilityRole="button" accessibilityLabel="Reintentar" onPress={() => void run(bar.failed)}>
                  <Text style={[type.subhead, styles.action]}>Reintentar</Text>
                </Pressable>
              )}
              <Pressable accessibilityRole="button" accessibilityLabel="Listo" onPress={() => setBar(null)}>
                <Text style={[type.subhead, styles.action]}>Listo</Text>
              </Pressable>
            </View>
          ) : (
            <Button
              label={selected.size > 0 ? `Guardar (${selected.size})` : "Guardar"}
              disabled={selected.size === 0 || !saver}
              onPress={() => void run(photos.filter((p) => selected.has(p.id)))}
            />
          )}
        </View>
      )}
    </View>
  );
}

function resultText(bar: Extract<Bar, { kind: "result" }>) {
  const noun = (n: number) => `${n} ${n === 1 ? "foto" : "fotos"}`;
  if (bar.failed.length > 0) return `Se guardaron ${bar.saved}. No se pudieron guardar ${noun(bar.failed.length)}.`;
  if (bar.cancelled) return `Se guardaron ${noun(bar.saved)} antes de cancelar.`;
  return `Guardadas ${bar.saved} ✓`;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  filter: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  header: { color: colors.label, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  row: { flexDirection: "row", gap: GAP, marginBottom: GAP },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg },
  empty: { color: colors.secondaryLabel, textAlign: "center", padding: spacing.xl },
  action: { color: colors.tint },
  video: { position: "absolute", left: 4, bottom: 4, flexDirection: "row", alignItems: "center", gap: 3 },
  videoText: { color: "#FFFFFF", fontVariant: ["tabular-nums"], textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 2 },
  check: {
    position: "absolute",
    right: 5,
    bottom: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  barRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.fill, overflow: "hidden" },
  fillBar: { height: 4, backgroundColor: colors.label },
});
