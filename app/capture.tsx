import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { startFix, type Fix } from "@/features/capture/location";
import { discard, prepareMedia, videoPoster } from "@/features/capture/media";
import { localDay, remaining } from "@/features/capture/quota";
import { getQueue } from "@/features/capture/store";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Body, Button, ErrorText } from "@/ui/components";
import { colors, radius, spacing, type } from "@/ui/theme";

type Left = { photos: number; videos: number } | null;
type Shot = { asset: ImagePicker.ImagePickerAsset; takenAt: number; poster: string };
type State =
  | { kind: "waiting" }
  | { kind: "locked" }
  | { kind: "no-permission" }
  | { kind: "preview"; shot: Shot; sending: boolean; error: string | null };

const MAX_VIDEO_S = 15;

/**
 * Captura: cámara del sistema → preview (repetir o mandar, con epígrafe) → cola.
 * Una vez en el rollo no se ve más hasta el revelado.
 */
export default function CaptureScreen() {
  const { trip } = useActiveTrip();
  const { detail, error: detailError } = useTripDetail(trip?.tripId);
  const [state, setState] = useState<State>({ kind: "waiting" });
  const [caption, setCaption] = useState("");
  const started = useRef(false);
  const left = useRef<Left>(null);
  const fix = useRef<Promise<Fix | null> | null>(null);
  const timeZone = detail?.trip.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

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
    setState({ kind: "preview", shot: { asset, takenAt: Date.now(), poster }, sending: false, error: null });
  }

  // Cuando sabemos el cupo (o que no hay señal para saberlo), abre la cámara o muestra el candado.
  useEffect(() => {
    if (!trip || started.current || (!detail && !detailError)) return;
    started.current = true;
    (async () => {
      const day = localDay(Date.now(), timeZone);
      const pending = await (await getQueue()).countPending(trip.tripId, day);
      left.current = remaining(detail?.today ?? null, day, pending);
      if (left.current && left.current.photos === 0 && left.current.videos === 0) return setState({ kind: "locked" });
      await openCamera();
    })();
  }, [trip, detail, detailError, timeZone]);

  async function retake(shot: Shot) {
    await discard(shot.asset.uri);
    setCaption("");
    setState({ kind: "waiting" });
    await openCamera();
  }

  async function send(shot: Shot) {
    if (!trip) return;
    setState({ kind: "preview", shot, sending: true, error: null });
    try {
      const id = Crypto.randomUUID();
      const [location, prepared] = await Promise.all([fix.current, prepareMedia(shot.asset, id)]);
      await (await getQueue()).enqueue({
        id,
        tripId: trip.tripId,
        type: shot.asset.type === "video" ? "video" : "photo",
        takenAt: shot.takenAt,
        day: localDay(shot.takenAt, timeZone),
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
        accuracyM: location?.accuracyM ?? null,
        caption: caption.trim() || null,
        ...prepared,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      setState({
        kind: "preview",
        shot,
        sending: false,
        error: e instanceof Error ? e.message : "No se pudo guardar. Probá de nuevo.",
      });
    }
  }

  if (state.kind === "locked") {
    return (
      <Message
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
  if (state.kind === "no-permission") {
    return (
      <Message
        symbol="camera.fill"
        title="Rollo necesita la cámara"
        body="Activala en Ajustes para sacar fotos del viaje."
        action={{ label: "Abrir Ajustes", onPress: () => Linking.openSettings() }}
      />
    );
  }
  if (state.kind === "waiting") return <View style={styles.dark} />;

  return (
    <Preview
      shot={state.shot}
      caption={caption}
      onCaption={setCaption}
      sending={state.sending}
      error={state.error}
      onRetake={() => retake(state.shot)}
      onSend={() => send(state.shot)}
    />
  );
}

function mediaTypesFor(left: Left): ImagePicker.MediaType[] {
  if (left?.videos === 0) return ["images"];
  if (left?.photos === 0) return ["videos"];
  return ["images", "videos"];
}

function Preview(props: {
  shot: Shot;
  caption: string;
  onCaption: (text: string) => void;
  sending: boolean;
  error: string | null;
  onRetake: () => void;
  onSend: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { asset, poster } = props.shot;
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.dark}>
      <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="contain" />
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Repetir"
          disabled={props.sending}
          onPress={props.onRetake}
          style={({ pressed }) => [styles.glass, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[type.body, styles.light]}>Repetir</Text>
        </Pressable>
        {asset.type === "video" && asset.duration ? (
          <Text style={[type.footnote, styles.dim]}>{`Video · ${Math.round(asset.duration / 1000)} s`}</Text>
        ) : null}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.md }]}>
        <TextInput
          accessibilityLabel="Epígrafe"
          placeholder="Agregá un epígrafe"
          placeholderTextColor="rgba(255,255,255,0.55)"
          value={props.caption}
          onChangeText={props.onCaption}
          maxLength={140}
          editable={!props.sending}
          style={[type.body, styles.caption]}
        />
        {props.error && <ErrorText>{props.error}</ErrorText>}
        <View style={styles.sendRow}>
          <Text style={[type.footnote, styles.dim, styles.note]}>Después de mandarla no la ves hasta el revelado</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mandar al rollo"
            accessibilityState={{ busy: props.sending, disabled: props.sending }}
            disabled={props.sending}
            onPress={props.onSend}
            style={({ pressed }) => [styles.send, { opacity: props.sending ? 0.6 : pressed ? 0.8 : 1 }]}
          >
            <Text style={[type.headline, { color: "#000" }]}>{props.sending ? "Guardando…" : "Mandar al rollo"}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Message(props: {
  symbol: "lock.fill" | "camera.fill";
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.message}>
      <SymbolView name={props.symbol} size={40} tintColor={colors.secondaryLabel as string} />
      <Text style={[type.title, { color: colors.label, textAlign: "center" }]}>{props.title}</Text>
      <Body muted>{props.body}</Body>
      <View style={styles.actions}>
        {props.action && <Button label={props.action.label} onPress={props.action.onPress} />}
        <Button label="Entendido" variant="secondary" onPress={() => router.back()} />
      </View>
    </View>
  );
}

// El preview es siempre oscuro, como la cámara: la foto manda.
const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: "#000" },
  top: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.md },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, gap: spacing.sm, paddingHorizontal: spacing.md },
  glass: { backgroundColor: "rgba(0,0,0,0.45)", borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 10 },
  light: { color: "#fff" },
  dim: { color: "rgba(255,255,255,0.75)" },
  caption: { color: "#fff", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: radius.lg, borderCurve: "continuous", paddingHorizontal: 18, minHeight: 50 },
  sendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  note: { flex: 1 },
  send: { backgroundColor: "#fff", borderRadius: radius.full, paddingHorizontal: 22, minHeight: 52, justifyContent: "center" },
  message: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background },
  actions: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.md },
});
