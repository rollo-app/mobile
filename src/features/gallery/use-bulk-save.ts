import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { Alert } from "react-native";
import type { RevealedPhoto } from "@/features/media/revealed";
import type { Bar } from "./bulk-save-state";
import {
  albumTitle,
  downloadAll,
  estimateBytes,
  formatMegabytes,
  PermissionDeniedError,
  requestAlbumAccess,
  withLinkedImages,
  type createSaver,
} from "./save";

type Saver = ReturnType<typeof createSaver>;

/**
 * Downloads to Photos: progress / cancel / result / retry / denied state, and "Guardar todo" with its
 * album and confirmation. `onSaved` runs after a pass finishes (the screen leaves selection mode).
 */
export function useBulkSave({
  saver,
  tripName,
  photos,
  loadAll,
  onSaved,
}: {
  saver: Saver | null;
  tripName: string | undefined;
  /** The photos loaded so far (the gallery may have only some pages). */
  photos: RevealedPhoto[];
  /** Loads every remaining page and resolves with all the photos; null if some page couldn't be loaded. Without it, `photos` is all there is. */
  loadAll?: () => Promise<RevealedPhoto[] | null>;
  onSaved: () => void;
}) {
  const [bar, setBar] = useState<Bar | null>(null);
  const [preparing, setPreparing] = useState(false);
  const abort = useRef<AbortController | null>(null);

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
      onSaved();
    } catch (e) {
      if (e instanceof PermissionDeniedError) setBar({ kind: "denied" });
      else setBar(null);
    } finally {
      abort.current = null;
    }
  }

  async function saveAll(everything: RevealedPhoto[]) {
    // Only "Guardar todo" uses the album, and iOS wants full library access to create it.
    const album = await requestAlbumAccess();
    await run(everything, { album, recents: !album });
  }

  /** Every photo of the roll, even the pages the gallery hasn't scrolled to; null (and an alert) if they couldn't be loaded. */
  async function everyPhoto(): Promise<RevealedPhoto[] | null> {
    if (!loadAll) return photos;
    setPreparing(true);
    try {
      const everything = await loadAll();
      if (!everything) Alert.alert("No se pudieron cargar todas las fotos", "Probá de nuevo cuando tengas señal.");
      return everything;
    } finally {
      setPreparing(false);
    }
  }

  async function confirmSaveAll() {
    const everything = await everyPhoto();
    if (!everything) return;
    const all = withLinkedImages(everything);
    Alert.alert(
      `Guardar ${all.length} ${all.length === 1 ? "foto" : "fotos"} en Fotos`,
      `Ocupa ~${formatMegabytes(estimateBytes(all))}. Conviene Wi-Fi.\n\nPara crear el álbum «${albumTitle(tripName ?? "")}» iOS pide acceso a tus fotos.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Guardar", onPress: () => void saveAll(everything) },
      ],
    );
  }

  const busy = bar?.kind === "progress" || preparing;
  return {
    bar,
    busy,
    canSaveAll: !busy && !!saver && photos.length > 0,
    run,
    confirmSaveAll,
    cancel: () => abort.current?.abort(),
    dismiss: () => setBar(null),
  };
}
