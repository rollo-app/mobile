import { featureActionAvailable } from "@/features/featured/feature-action";
import { MenuView, type MenuAction } from "@expo/ui/community/menu";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useMe } from "@/features/auth/use-me";
import { useToggleFeatured } from "@/features/featured/use-toggle-featured";
import { MomentBadge, momentBadgeCorner } from "@/features/media/moment-badge";
import { mediaSource, useRevealedPhotos, type RevealedPhoto } from "@/features/media/revealed";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { authorsOf, chunkRows, filterByAuthor, groupByDay } from "./group";
import { ownPhotoActions } from "./own-photo-actions";
import { PermissionNotice } from "./permission-notice";
import {
  albumTitle,
  downloadAll,
  withLinkedImages,
  estimateBytes,
  formatMegabytes,
  PermissionDeniedError,
  requestAlbumAccess,
} from "./save";
import { useArchivePhoto } from "./use-archive-photo";
import { useDeletePhoto } from "./use-delete-photo";
import { useSaver } from "./use-saver";

const COLUMNS = 3;
const GAP = 2;

type Bar =
  | { kind: "progress"; done: number; total: number }
  | {
      kind: "result";
      saved: number;
      failed: RevealedPhoto[];
      cancelled: boolean;
      album: boolean;
      recents: boolean;
    }
  | { kind: "denied" };

const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

type CellProps = {
  photo: RevealedPhoto;
  token: string | null;
  size: number;
  selecting: boolean;
  selected: boolean;
  /** Your own photo of the revealed roll: it can be archived or deleted. */
  own: boolean;
  onPress: (photo: RevealedPhoto) => void;
  onToggleFeatured: (photo: RevealedPhoto) => void;
  onOwnAction: (photo: RevealedPhoto, action: "archive" | "unarchive" | "delete") => void;
};

/**
 * The feed is rebuilt into new photo objects on every change (featuring one photo included), so cells
 * compare what they draw instead of the object: toggling one photo re-renders only that cell.
 */
function sameCell(a: CellProps, b: CellProps) {
  return (
    a.photo.id === b.photo.id &&
    a.photo.thumbPath === b.photo.thumbPath &&
    a.photo.thumbhash === b.photo.thumbhash &&
    a.photo.type === b.photo.type &&
    a.photo.durationS === b.photo.durationS &&
    a.photo.author.name === b.photo.author.name &&
    a.photo.featuredByMe === b.photo.featuredByMe &&
    a.photo.momentDay === b.photo.momentDay &&
    a.photo.archived === b.photo.archived &&
    a.photo.canFeature === b.photo.canFeature &&
    a.own === b.own &&
    a.onOwnAction === b.onOwnAction &&
    a.token === b.token &&
    a.size === b.size &&
    a.selecting === b.selecting &&
    a.selected === b.selected &&
    a.onPress === b.onPress &&
    a.onToggleFeatured === b.onToggleFeatured
  );
}

const Cell = memo(function Cell({ photo, token, size, selecting, selected, own, onPress, onToggleFeatured, onOwnAction }: CellProps) {
  const cell = (
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
          // Archived: only you see it, so it shows dimmed.
          style={[StyleSheet.absoluteFill, photo.archived && styles.archived]}
        />
      )}
      {photo.momentDay && <MomentBadge style={momentBadgeCorner} />}
      {photo.archived && (
        <View style={styles.archivedBadge}>
          <Text style={[type.caption, styles.archivedText]}>Archivada</Text>
        </View>
      )}
      {photo.type === "video" && (
        <View style={styles.video}>
          <SymbolView name="play.fill" size={10} tintColor="#FFFFFF" />
          {photo.durationS !== null && (
            <Text style={[type.caption, styles.videoText]}>{formatDuration(photo.durationS)}</Text>
          )}
        </View>
      )}
      {selecting && (
        <View
          style={[
            styles.check,
            selected && {
              backgroundColor: colors.tint,
              borderColor: colors.tint,
            },
          ]}
        >
          {selected && <SymbolView name="checkmark" size={12} weight="bold" tintColor={colors.onTint as string} />}
        </View>
      )}
    </Pressable>
  );
  // Long press opens the native context menu: featuring (videos and photos you can't feature have nothing to offer)
  // and, on your own photos, archive and delete. Selecting has its own taps.
  const actions: MenuAction[] = [
    ...(featureActionAvailable(photo)
      ? [
          photo.featuredByMe
            ? ({ id: "unfeature", title: "Sacar de tu perfil", image: "person.crop.circle.badge.minus" } as MenuAction)
            : ({ id: "feature", title: "Agregar a tu perfil", image: "person.crop.circle.badge.plus" } as MenuAction),
        ]
      : []),
    ...(own ? ownPhotoActions(photo) : []),
  ];
  if (selecting || photo.type !== "photo" || actions.length === 0) return cell;
  return (
    <MenuView
      shouldOpenOnLongPress
      style={{ width: size, height: size }}
      actions={actions}
      onPressAction={({ nativeEvent }) => {
        const event = nativeEvent.event;
        if (event === "archive" || event === "unarchive" || event === "delete") onOwnAction(photo, event);
        else onToggleFeatured(photo);
      }}
    >
      {cell}
    </MenuView>
  );
}, sameCell);

/**
 * Revealed roll: grid grouped by day, filter by person, and downloads to Photos. `toolbar` false hides
 * its header buttons while it stays mounted behind another view.
 */
export function GalleryScreen({ tripId, toolbar: showToolbar = true }: { tripId: string; toolbar?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { photos, token, error, loading, refetch } = useRevealedPhotos(tripId);
  const { detail } = useTripDetail(tripId);
  const saver = useSaver(token, detail?.trip.name, detail?.trip.timezone);
  const { toggle: toggleFeatured, error: featureError } = useToggleFeatured();
  const { me } = useMe();
  const revealed = detail?.trip.revealed === true;
  const setArchived = useArchivePhoto();
  const { confirmDelete } = useDeletePhoto();
  const [featureErrorDismissed, setFeatureErrorDismissed] = useState(false);
  useEffect(() => setFeatureErrorDismissed(false), [featureError]);

  const [authorId, setAuthorId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bar, setBar] = useState<Bar | null>(null);
  const abort = useRef<AbortController | null>(null);

  const size = Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS);
  const authors = useMemo(() => authorsOf(photos), [photos]);
  const shown = useMemo(() => filterByAuthor(photos, authorId), [photos, authorId]);
  const sections = useMemo(
    () =>
      groupByDay(shown).map((s) => ({
        title: s.title,
        data: chunkRows(s.photos, COLUMNS),
      })),
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
        router.push({
          pathname: "/photo/[id]",
          params: { id: photo.id, tripId },
        });
      }
    },
    [selecting, router, tripId],
  );

  const onToggleFeatured = useCallback(
    (photo: RevealedPhoto) => void toggleFeatured(photo, tripId),
    [toggleFeatured, tripId],
  );

  const onOwnAction = useCallback(
    (photo: RevealedPhoto, action: "archive" | "unarchive" | "delete") => {
      if (action === "delete") void confirmDelete(photo, tripId);
      else setArchived(photo, tripId, action === "archive");
    },
    [confirmDelete, setArchived, tripId],
  );

  const allSelected = shown.length > 0 && shown.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(shown.map((p) => p.id)));

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  /** `album`: put them in the roll's album; `recents`: the album was wanted but iOS access was limited. */
  async function run(chosen: RevealedPhoto[], { album = false, recents = false } = {}) {
    if (!saver || chosen.length === 0) return;
    // A moment's linked image has no feed item of its own: it goes right after its main photo.
    const list = withLinkedImages(chosen);
    const controller = new AbortController();
    abort.current = controller;
    setBar({ kind: "progress", done: 0, total: list.length });
    try {
      const result = await downloadAll(list, (photo) => saver(photo, { album }), {
        signal: controller.signal,
        onProgress: (done, total) => setBar({ kind: "progress", done, total }),
      });
      setBar({
        kind: "result",
        saved: result.saved,
        failed: result.failed,
        cancelled: result.cancelled,
        album,
        recents,
      });
      if (result.saved > 0 && result.failed.length === 0)
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      stopSelecting();
    } catch (e) {
      if (e instanceof PermissionDeniedError) setBar({ kind: "denied" });
      else setBar(null);
    } finally {
      abort.current = null;
    }
  }

  async function saveAll() {
    // Only "Guardar todo" uses the album, and iOS wants full library access to create it.
    const album = await requestAlbumAccess();
    await run(photos, { album, recents: !album });
  }

  function confirmSaveAll() {
    const all = withLinkedImages(photos);
    Alert.alert(
      `Guardar ${all.length} ${all.length === 1 ? "foto" : "fotos"} en Fotos`,
      `Ocupa ~${formatMegabytes(estimateBytes(all))}. Conviene Wi-Fi.\n\nPara crear el álbum «${albumTitle(detail?.trip.name ?? "")}» iOS pide acceso a tus fotos.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Guardar", onPress: () => void saveAll() },
      ],
    );
  }

  const busy = bar?.kind === "progress";
  const canSaveAll = !busy && !!saver && photos.length > 0;

  const toolbar = (
    <>
      {selecting && (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button onPress={toggleAll}>
            {allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      )}
      <Stack.Toolbar placement="right">
        {/* Direct children only: the header drops Fragments, which is how both buttons once vanished. */}
        {selecting && <Stack.Toolbar.Button onPress={stopSelecting}>Cancelar</Stack.Toolbar.Button>}
        {!selecting && (
          <Stack.Toolbar.Button disabled={busy || photos.length === 0} onPress={() => setSelecting(true)}>
            Seleccionar
          </Stack.Toolbar.Button>
        )}
        {!selecting && (
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
        )}
      </Stack.Toolbar>
    </>
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
        extraData={[selecting, selected, token, revealed, me?.id]}
        ListHeaderComponent={
          author ? (
            <View style={styles.filter}>
              <Text style={[type.subhead, { color: colors.secondaryLabel }]}>{`Solo ${author.name}`}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Quitar filtro"
                hitSlop={10}
                onPress={() => setAuthorId(null)}
              >
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
                own={revealed && !!me && photo.authorUserId === me.id}
                onPress={onCellPress}
                onToggleFeatured={onToggleFeatured}
                onOwnAction={onOwnAction}
              />
            ))}
          </View>
        )}
        ListEmptyComponent={
          <Text style={[type.body, styles.empty]}>
            {author ? `${author.name} no sacó fotos` : "Este rollo no tiene fotos"}
          </Text>
        }
      />
    );

  // No wrapping View: the list must be the screen's first child for the native header to find it as the
  // main scroll view (large title collapses, edge effect). Stack.Screen and Toolbar render nothing.
  return (
    <>
      {body}
      {showToolbar && toolbar}
      {!bar && !selecting && featureError && !featureErrorDismissed && (
        <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <View style={styles.barRow}>
            <View style={{ flex: 1 }}>
              <ErrorText>{featureError}</ErrorText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Listo" onPress={() => setFeatureErrorDismissed(true)}>
              <Text style={[type.subhead, styles.action]}>Listo</Text>
            </Pressable>
          </View>
        </View>
      )}
      {(bar || selecting) && (
        <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.sm }]}>
          {bar?.kind === "progress" ? (
            <>
              <View style={styles.barRow}>
                <Text
                  style={[type.subhead, { color: colors.label }]}
                >{`Guardando ${Math.min(bar.done + 1, bar.total)} de ${bar.total}`}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar descarga"
                  onPress={() => abort.current?.abort()}
                >
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
              <Text style={[type.subhead, { color: colors.label, flex: 1 }]}>{resultText(bar)}</Text>
              {bar.failed.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Reintentar"
                  onPress={() =>
                    void run(bar.failed, {
                      album: bar.album,
                      recents: bar.recents,
                    })
                  }
                >
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
    </>
  );
}

function resultText(bar: Extract<Bar, { kind: "result" }>) {
  const noun = (n: number) => `${n} ${n === 1 ? "foto" : "fotos"}`;
  if (bar.failed.length > 0) return `Se guardaron ${bar.saved}. No se pudieron guardar ${noun(bar.failed.length)}.`;
  if (bar.cancelled) return `Se guardaron ${noun(bar.saved)} antes de cancelar.`;
  if (bar.recents) return `Se guardaron ${noun(bar.saved)} en Recientes`;
  if (bar.recents) return `Se guardaron ${noun(bar.saved)} en Recientes`;
  return `Guardadas ${bar.saved} ✓`;
}

const styles = StyleSheet.create({
  filter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  header: {
    color: colors.label,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  row: { flexDirection: "row", gap: GAP, marginBottom: GAP },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  empty: {
    color: colors.secondaryLabel,
    textAlign: "center",
    padding: spacing.xl,
  },
  action: { color: colors.tint },
  video: {
    position: "absolute",
    left: 4,
    bottom: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  archived: { opacity: 0.35 },
  archivedBadge: {
    position: "absolute",
    left: 4,
    bottom: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  archivedText: { color: "#FFFFFF" },
  videoText: {
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 2,
  },
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
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.fill,
    overflow: "hidden",
  },
  fillBar: { height: 4, backgroundColor: colors.label },
});
