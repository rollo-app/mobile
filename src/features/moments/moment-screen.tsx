import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useCameraPermission } from "react-native-vision-camera";
import { errorMessage } from "@/api/client";
import { Camera, CloseButton } from "@/features/camera/camera";
import type { CapturedPhoto } from "@/features/camera/captured-photo";
import { CaptureMessage } from "@/features/capture/capture-message";
import { CapturePreview, type Shot } from "@/features/capture/capture-preview";
import { startFix, type Fix } from "@/features/capture/location";
import { localDay } from "@/features/capture/quota";
import { useSendShot } from "@/features/capture/use-send-shot";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { formatLeft, momentState } from "./moment-time";

type Facing = "back" | "front";
type FacingShot = Shot & { facing: Facing };
type Step = { kind: "main" } | { kind: "second"; main: FacingShot } | { kind: "preview"; main: FacingShot; selfie: FacingShot | null };

/**
 * The daily moment: the camera under a countdown (the back one first; it can be flipped before shooting). The first
 * photo is the main one, whichever camera took it; if the roll asks for it the other camera takes a second one, linked
 * to it (`selfie` in the contract means "the linked image"). Then the regular caption screen. The window only gates
 * taking the first photo: once you have it you can finish.
 */
export function MomentScreen(props: { tripId?: string; day?: string; at?: number; selfie?: string }) {
  const { trip, trips } = useActiveTrip();
  const tripId = props.tripId ?? trip?.id;
  const { detail } = useTripDetail(tripId);
  const sendShot = useSendShot();
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const [step, setStep] = useState<Step>({ kind: "main" });
  const [firstFacing, setFirstFacing] = useState<Facing>("back");
  const [caption, setCaption] = useState("");
  const [now, setNow] = useState(Date.now());
  const fix = useRef<Promise<Fix | null> | null>(null);

  const timeZone = detail?.trip.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  // The camera never waits for the trip detail (with no signal it would wait forever). The second shot comes from the
  // notification's `selfie` param, then from the detail if it is loaded, and otherwise it is the photo alone: the
  // server rejects a linked image on a photo-only roll, so it is never guessed.
  const withSelfie = props.selfie === "1" ? true : props.selfie === "0" ? false : detail?.trip.momentMode === "photo_selfie";
  const endsAt = detail?.trip.endsAt ?? trips.find((t) => t.id === tripId)?.endsAt;
  const state = props.at != null && Number.isFinite(props.at) ? momentState(props.at, now) : ({ kind: "late" } as const);
  const day = props.day ?? (props.at != null ? localDay(props.at, timeZone) : undefined);

  useEffect(() => {
    if (canRequestPermission) void requestPermission();
  }, [canRequestPermission, requestPermission]);

  // The countdown ticks only while the first photo is pending.
  useEffect(() => {
    if (step.kind !== "main") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step.kind]);

  useEffect(() => {
    if (hasPermission) fix.current ??= startFix();
  }, [hasPermission]);

  function send(main: FacingShot, selfie: FacingShot | null) {
    if (!tripId || !day) return;
    sendShot.mutate(
      {
        tripId,
        photo: main.photo,
        takenAt: main.takenAt,
        facing: main.facing,
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
        inset={step.selfie?.photo ?? null}
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
  if (!hasPermission && !canRequestPermission) {
    return (
      <CaptureMessage
        symbol="camera.fill"
        title="Rollo necesita la cámara"
        body="Activala en Ajustes para sacar fotos del rollo."
        action={{ label: "Abrir Ajustes", onPress: () => Linking.openSettings() }}
      />
    );
  }
  if (!hasPermission) {
    return (
      <View style={styles.dark}>
        <CloseButton onPress={() => router.back()} />
      </View>
    );
  }

  if (step.kind === "second") {
    const other: Facing = step.main.facing === "back" ? "front" : "back";
    return (
      <Camera
        key={`second-${other}`}
        facing={other}
        title="Ahora con la otra cámara."
        onCapture={(photo) => setStep({ kind: "preview", main: step.main, selfie: { photo, takenAt: Date.now(), facing: other } })}
      />
    );
  }
  return (
    <Camera
      key={`first-${firstFacing}`}
      facing={firstFacing}
      onClose={() => router.back()}
      onFlip={() => setFirstFacing((f) => (f === "back" ? "front" : "back"))}
      title={state.kind === "open" ? `Tu momento · quedan ${formatLeft(state.leftMs)}` : ""}
      notice={withSelfie ? "Sacás con las dos cámaras. La primera va a ser la grande." : undefined}
      onCapture={(photo) => {
        const main = { photo, takenAt: Date.now(), facing: firstFacing };
        setStep(withSelfie ? { kind: "second", main } : { kind: "preview", main, selfie: null });
      }}
    />
  );
}

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: "#000" },
});
