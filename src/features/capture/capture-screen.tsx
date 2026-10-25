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
import { closedMessage, exhaustedMessage } from "./capture-copy";
import { startFix, type Fix } from "./location";
import { loadLeft } from "./load-left";
import { useSendShot } from "./use-send-shot";

type State =
  | { kind: "waiting" }
  | { kind: "locked" }
  | { kind: "closed"; title: string; body: string }
  | { kind: "no-permission" }
  | { kind: "preview"; shot: Shot };

// If the screen never reports that it appeared, open the camera anyway after this.
const APPEAR_FALLBACK_MS = 1000;

/**
 * Capture: system camera → blurred shot with a caption → queue. There is no retake: the shot is the shot.
 * Once in the roll it can't be seen again until the reveal.
 */
export function CaptureScreen() {
  const { trip, loaded } = useActiveTrip();
  const { detail, error: detailError } = useTripDetail(trip?.id);
  const sendShot = useSendShot();
  const [state, setState] = useState<State>({ kind: "waiting" });
  const [caption, setCaption] = useState("");
  const started = useRef(false);
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
      mediaTypes: ["images"],
      quality: 1,
      exif: false,
    });
    if (result.canceled || !result.assets?.[0]) return router.back();

    setState({ kind: "preview", shot: { asset: result.assets[0], takenAt: Date.now() } });
  }

  // Once we know the quota (or that there's no signal to know it), open the camera or show the lock.
  useEffect(() => {
    if (!appeared || !loaded || !trip || started.current || (!detail && !detailError)) return;
    started.current = true;
    const closed = detail && closedMessage(detail.trip, Date.now());
    if (closed) return setState({ kind: "closed", ...closed });
    (async () => {
      const left = detail ? await loadLeft(detail, Date.now()) : null;
      if (left && left.photos === 0) return setState({ kind: "locked" });
      await openCamera();
    })();
  }, [appeared, loaded, trip, detail, detailError, timeZone]);

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
    const { title, body } = exhaustedMessage(detail?.trip ?? null);
    return <CaptureMessage symbol="lock.fill" title={title} body={body} />;
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
      onSend={() => send(state.shot)}
    />
  );
}

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: "#000" },
});
