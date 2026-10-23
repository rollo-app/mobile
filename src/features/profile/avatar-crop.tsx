import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, ErrorText } from "@/ui/components";
import { spacing, type } from "@/ui/theme";
import { cropAvatarImage } from "./crop-avatar-image";
import { clampOffset, clampZoom, cropRect, displayedSize, type Offset } from "./crop-math";
import { cropRequestPhoto, settleCropRequest } from "./crop-request";

export const CROP_BACKGROUND = "#000000";
const GUTTER = 16;

type Touches = GestureResponderEvent["nativeEvent"]["touches"];
const midpoint = (t: Touches) => ({
  x: t.reduce((sum, touch) => sum + touch.pageX, 0) / t.length,
  y: t.reduce((sum, touch) => sum + touch.pageY, 0) / t.length,
});
const distance = (t: Touches) => Math.hypot(t[0]!.pageX - t[1]!.pageX, t[0]!.pageY - t[1]!.pageY);

/**
 * Square profile photo crop (like Contacts): the photo behind a circle, pinch to zoom and drag to move,
 * always covering the circle. "Elegir" hands a 512×512 JPEG back to whoever opened the crop.
 */
export function AvatarCrop({ requestId }: { requestId: string | undefined }) {
  // Read once: after "Elegir" the request is gone, and the screen must not react to that while it closes.
  const [photo] = useState(() => cropRequestPhoto(requestId));
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const diameter = width - 2 * GUTTER;
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live values for the responder, plus where the current gesture started.
  const live = useRef({ zoom: 1, offset: { x: 0, y: 0 } });
  const start = useRef({ touches: 0, dist: 0, mid: { x: 0, y: 0 }, zoom: 1, offset: { x: 0, y: 0 } });

  // Leaving any other way (or a crop that no longer exists) counts as cancelling.
  useEffect(() => {
    if (!photo) {
      if (router.canGoBack()) router.back();
      else router.replace("/");
    }
    return () => settleCropRequest(requestId, null);
  }, [photo, requestId]);

  const responder = useMemo(() => {
    const begin = (t: Touches) => {
      start.current = {
        touches: t.length,
        dist: t.length >= 2 ? distance(t) : 0,
        mid: midpoint(t),
        zoom: live.current.zoom,
        offset: live.current.offset,
      };
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => begin(e.nativeEvent.touches),
      onPanResponderMove: (e) => {
        const t = e.nativeEvent.touches;
        if (!photo || t.length === 0) return;
        // A finger added or lifted: restart from here so nothing jumps.
        if (t.length !== start.current.touches) return begin(t);
        const s = start.current;
        const nextZoom = t.length >= 2 && s.dist > 0 ? clampZoom((s.zoom * distance(t)) / s.dist) : s.zoom;
        const ratio = nextZoom / s.zoom;
        const mid = midpoint(t);
        const nextOffset = clampOffset(
          { x: s.offset.x * ratio + mid.x - s.mid.x, y: s.offset.y * ratio + mid.y - s.mid.y },
          photo,
          diameter,
          nextZoom,
        );
        live.current = { zoom: nextZoom, offset: nextOffset };
        setZoom(nextZoom);
        setOffset(nextOffset);
      },
    });
  }, [photo, diameter]);

  if (!photo) return <View style={styles.screen} />;

  const shown = displayedSize(photo, diameter, zoom);
  // A huge border around a transparent circle dims everything but the circle.
  const ring = Math.max(width, height);

  async function choose() {
    if (!photo) return;
    setError(null);
    setSaving(true);
    try {
      const cropped = await cropAvatarImage(photo.uri, cropRect(photo, diameter, zoom, offset));
      settleCropRequest(requestId, cropped);
      router.back();
    } catch {
      setError("No se pudo recortar la foto. Probá de nuevo.");
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={StyleSheet.absoluteFill} {...responder.panHandlers}>
        <Image
          source={{ uri: photo.uri }}
          accessibilityIgnoresInvertColors
          style={{
            position: "absolute",
            width: shown.width,
            height: shown.height,
            left: width / 2 - shown.width / 2 + offset.x,
            top: height / 2 - shown.height / 2 + offset.y,
          }}
        />
        <View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: diameter + 2 * ring,
              height: diameter + 2 * ring,
              left: width / 2 - diameter / 2 - ring,
              top: height / 2 - diameter / 2 - ring,
              borderWidth: ring,
              borderRadius: diameter / 2 + ring,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.circle,
            { width: diameter, height: diameter, borderRadius: diameter / 2, left: GUTTER, top: height / 2 - diameter / 2 },
          ]}
        />
      </View>
      <Text style={[type.headline, styles.title, { top: insets.top + spacing.md }]} pointerEvents="none">
        Mové y ajustá
      </Text>
      <View style={[styles.toolbar, { paddingBottom: insets.bottom + spacing.md }]}>
        {error && <ErrorText>{error}</ErrorText>}
        <View style={styles.buttons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
            hitSlop={12}
            disabled={saving}
            onPress={() => {
              settleCropRequest(requestId, null);
              router.back();
            }}
          >
            <Text style={[type.body, styles.cancel]}>Cancelar</Text>
          </Pressable>
          <Button label="Elegir" onPress={() => void choose()} loading={saving} style={styles.choose} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CROP_BACKGROUND, overflow: "hidden" },
  ring: { position: "absolute", borderColor: "rgba(0, 0, 0, 0.6)" },
  circle: { position: "absolute", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255, 255, 255, 0.6)" },
  title: { position: "absolute", left: 0, right: 0, textAlign: "center", color: "#FFFFFF" },
  toolbar: { position: "absolute", left: 0, right: 0, bottom: 0, gap: spacing.sm, paddingHorizontal: spacing.lg },
  buttons: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cancel: { color: "#FFFFFF" },
  choose: { paddingHorizontal: spacing.xl },
});
