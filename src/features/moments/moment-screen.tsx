import { useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { errorMessage } from "@/api/client";
import { CaptureMessage } from "@/features/capture/capture-message";
import { CapturePreview, type Shot } from "@/features/capture/capture-preview";
import { startFix, type Fix } from "@/features/capture/location";
import { localDay } from "@/features/capture/quota";
import { useSendShot } from "@/features/capture/use-send-shot";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { CloseButton, MomentCamera } from "./moment-camera";
import { formatLeft, momentState } from "./moment-time";

type Step = { kind: "main" } | { kind: "selfie"; main: Shot } | { kind: "preview"; main: Shot; selfie: Shot | null };

/**
 * The daily moment: back camera under a countdown, then (if the roll asks for it) the selfie, then the
 * regular caption screen. The window only gates taking the first photo: once you have it you can finish.
 */
export function MomentScreen(props: { tripId?: string; day?: string; at?: number; selfie?: string }) {
  const { trip, trips } = useActiveTrip();
  const tripId = props.tripId ?? trip?.id;
  const { detail } = useTripDetail(tripId);
  const sendShot = useSendShot();
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>({ kind: "main" });
  const [caption, setCaption] = useState("");
  const [now, setNow] = useState(Date.now());
  const fix = useRef<Promise<Fix | null> | null>(null);

  const timeZone = detail?.trip.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  // The camera never waits for the trip detail (with no signal it would wait forever). The selfie step comes from the
  // notification's `selfie` param, then from the detail if it is loaded, and otherwise it is the photo alone: the
  // server rejects a selfie on a photo-only roll, so it is never guessed.
  const withSelfie = props.selfie === "1" ? true : props.selfie === "0" ? false : detail?.trip.momentMode === "photo_selfie";
  const endsAt = detail?.trip.endsAt ?? trips.find((t) => t.id === tripId)?.endsAt;
  const state = props.at != null && Number.isFinite(props.at) ? momentState(props.at, now) : ({ kind: "late" } as const);
  const day = props.day ?? (props.at != null ? localDay(props.at, timeZone) : undefined);

  useEffect(() => {
    if (permission?.status === "undetermined") void requestPermission();
  }, [permission?.status, requestPermission]);

  // The countdown ticks only while the first photo is pending.
  useEffect(() => {
    if (step.kind !== "main") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step.kind]);

  useEffect(() => {
    if (permission?.granted) fix.current ??= startFix();
  }, [permission?.granted]);

  function send(main: Shot, selfie: Shot | null) {
    if (!tripId || !day) return;
    sendShot.mutate(
      {
        tripId,
        asset: main.asset,
        takenAt: main.takenAt,
        timeZone,
        caption,
        author: detail?.me.name ?? "",
        fix: fix.current,
        momentDay: day,
        selfie: selfie ?? undefined,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
      },
    );
  }

  if (step.kind === "preview") {
    return (
      <CapturePreview
        shot={step.main}
        caption={caption}
        onCaption={setCaption}
        sending={sendShot.isPending}
        error={errorMessage(sendShot.error, "No se pudo guardar. Probá de nuevo.")}
        onSend={() => send(step.main, step.selfie)}
      />
    );
  }
  if (step.kind === "main" && state.kind === "late") {
    const lastDay = day != null && endsAt != null && day === localDay(endsAt, timeZone);
    return (
      <CaptureMessage
        symbol="lock.fill"
        title="Se pasó tu momento de hoy"
        body={lastDay ? "Era el último del rollo." : "Mañana te toca otro."}
      />
    );
  }
  if (permission && !permission.granted && permission.status !== "undetermined") {
    return (
      <CaptureMessage
        symbol="camera.fill"
        title="Rollo necesita la cámara"
        body="Activala en Ajustes para sacar fotos del rollo."
        action={{ label: "Abrir Ajustes", onPress: () => Linking.openSettings() }}
      />
    );
  }
  if (!permission?.granted) {
    return (
      <View style={styles.dark}>
        <CloseButton onPress={() => router.back()} />
      </View>
    );
  }

  if (step.kind === "selfie") {
    return (
      <MomentCamera
        key="front"
        facing="front"
        title="Ahora, una selfie"
        onCapture={(asset) => setStep({ kind: "preview", main: step.main, selfie: { asset, takenAt: Date.now() } })}
      />
    );
  }
  return (
    <MomentCamera
      key="back"
      facing="back"
      onClose={() => router.back()}
      title={state.kind === "open" ? `Tu momento · quedan ${formatLeft(state.leftMs)}` : ""}
      onCapture={(asset) => {
        const main = { asset, takenAt: Date.now() };
        setStep(withSelfie ? { kind: "selfie", main } : { kind: "preview", main, selfie: null });
      }}
    />
  );
}

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: "#000" },
});
