import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useNavigation, type NativeStackNavigationProp } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { errorMessage } from "@/api/client";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { CaptureMessage } from "./capture-message";
import { CapturePreview, type Shot } from "./capture-preview";
import { closedMessage, mediaTypesFor, type Left } from "./capture-copy";
import { startFix, type Fix } from "./location";
import { discard, videoPoster } from "./media";
import { localDay, remaining } from "./quota";
import { getQueue } from "./store";
import { useSendShot } from "./use-send-shot";

type State =
  | { kind: "waiting" }
  | { kind: "locked" }
  | { kind: "closed"; title: string; body: string }
  | { kind: "no-permission" }
  | { kind: "preview"; shot: Shot };

const MAX_VIDEO_S = 15;
// If the screen never reports that it appeared, open the camera anyway after this.
const APPEAR_FALLBACK_MS = 1000;

/**
 * Capture: system camera → preview (retake or send, with caption) → queue.
 * Once in the roll it can't be seen again until the reveal.
 */
export function CaptureScreen() {
  const { trip, loaded } = useActiveTrip();
  const { detail, error: detailError } = useTripDetail(trip?.id);
  const sendShot = useSendShot();
  const [state, setState] = useState<State>({ kind: "waiting" });
  const [caption, setCaption] = useState("");
  const started = useRef(false);
  const left = useRef<Left>(null);
  const fix = useRef<Promise<Fix | null> | null>(null);
  const timeZone = detail?.trip.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  // iOS can't present the camera while this modal is still animating in (for example when it
  // replaces "Arrancó el rollo"): the picker fails silently and the screen stays black.
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const [appeared, setAppeared] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setAppeared(true), APPEAR_FALLBACK_MS);
    const unsubscribe = navigation.addListener("transitionEnd", (e) => {
      if (!e.data.closing) setAppeared(true);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [navigation]);

  async function openCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return setState({ kind: "no-permission" });

    fix.current ??= startFix();
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: mediaTypesFor(left.current),
      videoMaxDuration: MAX_VIDEO_S,
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1920x1080,
      quality: 1,
      exif: false,
    });
    if (result.canceled || !result.assets?.[0]) return router.back();

    const asset = result.assets[0];
    const poster = asset.type === "video" ? await videoPoster(asset.uri) : asset.uri;
    setState({ kind: "preview", shot: { asset, takenAt: Date.now(), poster } });
  }

  // Once we know the quota (or that there's no signal to know it), open the camera or show the lock.
  useEffect(() => {
    if (!appeared || !loaded || !trip || started.current || (!detail && !detailError)) return;
    started.current = true;
    const closed = detail && closedMessage(detail.trip, Date.now());
    if (closed) return setState({ kind: "closed", ...closed });
    (async () => {
      const day = localDay(Date.now(), timeZone);
      const pending = await (await getQueue()).countPending(trip.id, day);
      left.current = remaining(detail?.today ?? null, day, pending);
      if (left.current && left.current.photos === 0 && left.current.videos === 0) return setState({ kind: "locked" });
      await openCamera();
    })();
  }, [appeared, loaded, trip, detail, detailError, timeZone]);

  async function retake(shot: Shot) {
    await discard(shot.asset.uri);
    setCaption("");
    sendShot.reset();
    setState({ kind: "waiting" });
    await openCamera();
  }

  function send(shot: Shot) {
    if (!trip) return;
    sendShot.mutate(
      {
        tripId: trip.id,
        asset: shot.asset,
        takenAt: shot.takenAt,
        timeZone,
        caption,
        author: detail?.me.name ?? "",
        fix: fix.current,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
      },
    );
  }

  if (state.kind === "locked") {
    return (
      <CaptureMessage
        symbol="lock.fill"
        title="Se terminó el rollo de hoy"
        body={
          detail
            ? `Mañana tenés ${detail.trip.dailyPhotoLimit} fotos y ${detail.trip.dailyVideoLimit} videos nuevos.`
            : "Mañana se renueva."
        }
      />
    );
  }
  if (state.kind === "closed") return <CaptureMessage symbol="lock.fill" title={state.title} body={state.body} />;
  if (state.kind === "no-permission") {
    return (
      <CaptureMessage
        symbol="camera.fill"
        title="Rollo necesita la cámara"
        body="Activala en Ajustes para sacar fotos del rollo."
        action={{ label: "Abrir Ajustes", onPress: () => Linking.openSettings() }}
      />
    );
  }
  if (state.kind === "waiting") return <View style={styles.dark} />;

  return (
    <CapturePreview
      shot={state.shot}
      caption={caption}
      onCaption={setCaption}
      sending={sendShot.isPending}
      error={errorMessage(sendShot.error, "No se pudo guardar. Probá de nuevo.")}
      onRetake={() => retake(state.shot)}
      onSend={() => send(state.shot)}
    />
  );
}

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: "#000" },
});
