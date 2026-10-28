import { useMemo, useState, type RefObject } from "react";
import type { CameraDevice, CameraRef } from "react-native-vision-camera";
import { activePreset, frontExpand, isExpanded, zoomLevels } from "./zoom";
import type { useCameraSession } from "./use-camera-session";

/** How fast a chip tap ramps the zoom (AVFoundation's rate: doublings per second), about 0.2 s from 1× to 3×. */
const ZOOM_RAMP_RATE = 8;

type Session = ReturnType<typeof useCameraSession>["session"];

/**
 * Zoom is raw device zoom; each device starts at its 1x (the wide lens), so flipping starts over. The `zoom` prop only
 * sets that start: pinch, chips and "Ampliar encuadre" drive the controller directly (with a ramp, like the iPhone).
 */
export function useCameraZoom(args: {
  camera: RefObject<CameraRef | null>;
  device: CameraDevice | undefined;
  session: Session;
  onError: (error: Error) => void;
}) {
  const { camera, device, session, onError } = args;
  const levels = useMemo(
    () =>
      device
        ? zoomLevels({
            position: device.position,
            minZoom: Math.max(device.minZoom, session?.minZoom ?? 0),
            maxZoom: Math.min(device.maxZoom, session?.maxZoom ?? Infinity),
            zoomLensSwitchFactors: device.zoomLensSwitchFactors,
            physicalDevices: device.physicalDevices,
            displayMultiplier: session?.multiplier,
          })
        : null,
    [device, session],
  );
  const [zoomState, setZoomState] = useState<{ deviceId: string; zoom: number } | null>(null);
  const zoom = levels && device ? (zoomState?.deviceId === device.id ? zoomState.zoom : levels.neutral) : 1;
  const factor = levels ? zoom / levels.neutral : 1;
  const chip = levels ? activePreset(levels.presets, factor) : undefined;
  const expand = levels && device && session ? frontExpand(levels, device.position) : null;
  const expanded = expand ? isExpanded(expand, zoom) : false;

  function applyZoom(next: number, ramp: boolean) {
    if (!device || !session) return;
    setZoomState({ deviceId: device.id, zoom: next });
    try {
      const done = ramp ? camera.current?.startZoomAnimation(next, ZOOM_RAMP_RATE) : camera.current?.controller?.setZoom(next);
      done?.catch(onError);
    } catch (error) {
      onError(error as Error);
    }
  }

  return { levels, zoom, factor, chip, expand, expanded, applyZoom };
}
