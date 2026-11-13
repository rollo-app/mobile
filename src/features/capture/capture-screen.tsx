import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useCameraPermission } from "react-native-vision-camera";
import { errorMessage } from "@/api/client";
import { Camera } from "@/features/camera/camera";
import { isEvent, isOrganizer, sendableGroups } from "@/features/events/event";
import { getLastGroups, setLastGroups } from "@/storage/last-groups";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { CaptureMessage } from "./capture-message";
import { CapturePreview, type Shot } from "./capture-preview";
import { discard } from "./media";
import { closedMessage, exhaustedMessage } from "./capture-copy";
import { startFix, type Fix } from "./location";
import { loadLeft } from "./load-left";
import { useSendShot } from "./use-send-shot";

type State =
  | { kind: "waiting" }
  | { kind: "locked" }
  | { kind: "closed"; title: string; body: string }
  | { kind: "camera" }
  | { kind: "preview"; shot: Shot };

/**
 * Capture: the app's camera → blurred shot with a caption → queue. There is no retake: the shot is the shot.
 * (The system camera always offers "Repetir / Usar foto" after shooting, so it is not used.)
 * Once in the roll it can't be seen again until the reveal.
 */
export function CaptureScreen() {
  const { trip, loaded } = useActiveTrip();
  const { detail, error: detailError } = useTripDetail(trip?.id);
  const sendShot = useSendShot();
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const [state, setState] = useState<State>({ kind: "waiting" });
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [caption, setCaption] = useState("");
  const [sent, setSent] = useState(false);
  const started = useRef(false);
  const fix = useRef<Promise<Fix | null> | null>(null);
  const [chosenGroups, setChosenGroups] = useState<string[] | null>(null);
  // An event's photos never carry a location: guests don't need to be placed on a map.
  const inEvent = !!detail && isEvent(detail.trip);
  const groups = detail && inEvent ? sendableGroups(detail) : [];
  const choosing = groups.length > 1;
  const timeZone = detail?.trip.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    // Only when the camera is about to show: not over the "closed" or "no photos left" messages.
    if (state.kind === "camera" && canRequestPermission) void requestPermission();
  }, [state.kind, canRequestPermission, requestPermission]);

  // Ask for the location as soon as the camera is up, so the fix is ready by the time the shot is sent.
  useEffect(() => {
    if (state.kind === "camera" && hasPermission && !inEvent) fix.current ??= startFix();
  }, [state.kind, hasPermission, inEvent]);

  // With several groups to choose from, start with the ones used last (the ones that still count), else the first.
  const previewing = state.kind === "preview";
  const groupIdsKey = groups.map((g) => g.id).join(",");
  useEffect(() => {
    if (!previewing || !trip || !choosing || chosenGroups) return;
    let active = true;
    getLastGroups(trip.id)
      .catch(() => [] as string[])
      .then((last) => {
        if (!active) return;
        const valid = groups.filter((g) => last.includes(g.id)).map((g) => g.id);
        setChosenGroups(valid.length ? valid : groups.slice(0, 1).map((g) => g.id));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- groups is derived from groupIdsKey
  }, [previewing, trip?.id, choosing, chosenGroups, groupIdsKey]);

  // Once we know the quota (or that there's no signal to know it), open the camera or show the lock.
  useEffect(() => {
    if (!loaded || !trip || started.current || (!detail && !detailError)) return;
    started.current = true;
    const closed = detail && closedMessage(detail.trip, Date.now());
    if (closed) return setState({ kind: "closed", ...closed });
    (async () => {
      const left = detail ? await loadLeft(detail, Date.now()) : null;
      setState(left && left.photos === 0 ? { kind: "locked" } : { kind: "camera" });
    })();
  }, [loaded, trip, detail, detailError, timeZone]);

  function send(shot: Shot) {
    if (!trip) return;
    // One group: the photo goes there. Several: the chosen ones (kept for the next photo).
    const groupIds = choosing ? (chosenGroups ?? []) : groups.map((g) => g.id);
    if (choosing) void setLastGroups(trip.id, groupIds).catch(() => {});
    sendShot.mutate(
      {
        tripId: trip.id,
        photo: shot.photo,
        takenAt: shot.takenAt,
        timeZone,
        caption,
        author: detail?.me.name ?? "",
        fix: fix.current,
        ...(inEvent && groupIds.length ? { groupIds } : {}),
      },
      {
        onSuccess: () => {
          // The haptic goes with the start of the photo's exit; the screen closes when it's over (onGone).
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setSent(true);
        },
      },
    );
  }

  if (state.kind === "locked") {
    const { title, body } = exhaustedMessage(detail?.trip ?? null);
    return <CaptureMessage symbol="lock.fill" title={title} body={body} />;
  }
  if (state.kind === "closed") return <CaptureMessage symbol="lock.fill" title={state.title} body={state.body} />;
  if (state.kind === "waiting") return <View style={styles.dark} />;
  if (state.kind === "camera") {
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
    if (!hasPermission) return <View style={styles.dark} />;
    return (
      <Camera
        key={facing}
        facing={facing}
        title=""
        onClose={() => router.back()}
        onFlip={() => setFacing((f) => (f === "back" ? "front" : "back"))}
        onCapture={(photo) => setState({ kind: "preview", shot: { photo, takenAt: Date.now() } })}
      />
    );
  }

  return (
    <CapturePreview
      shot={state.shot}
      caption={caption}
      onCaption={setCaption}
      sending={sendShot.isPending}
      sent={sent}
      onGone={() => router.back()}
      error={errorMessage(sendShot.error, "No se pudo guardar. Probá de nuevo.")}
      groups={choosing ? groups : undefined}
      selectedGroupIds={chosenGroups ?? []}
      onGroupsChange={setChosenGroups}
      allGroupsOption={!!detail && isOrganizer(detail)}
      onSend={() => send(state.shot)}
      onDiscard={() => {
        void discard(state.shot.photo.uri);
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: "#000" },
});
