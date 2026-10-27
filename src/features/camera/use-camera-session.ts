import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCameraDevices, usePhotoOutput, type CameraRef, type CapturePhotoSettings } from "react-native-vision-camera";
import { bestPhotoResolution, pickCameraDevice } from "./device";
import type { FlashMode } from "./flash";

/**
 * Every shot: the chosen flash. No `enableDistortionCorrection`: VisionCamera 5.2.3 sets it per shot without enabling
 * it on the photo output, and AVFoundation throws inside capturePhoto (a native crash).
 */
export const captureSettings = (flash: FlashMode): CapturePhotoSettings => ({ flashMode: flash });

/** The device for a side, its photo output (max quality 4:3) and the running session's real zoom data. */
export function useCameraSession(facing: "back" | "front", flash: FlashMode) {
  const camera = useRef<CameraRef>(null);
  const devices = useCameraDevices();
  const device = pickCameraDevice(devices, facing);

  const targetResolution = useMemo(() => bestPhotoResolution(device?.getSupportedResolutions("photo") ?? []), [device]);
  const photoOutput = usePhotoOutput({ targetResolution, containerFormat: "jpeg", quality: 1, qualityPrioritization: "quality" });
  const outputs = useMemo(() => [photoOutput], [photoOutput]);
  const constraints = useMemo(() => [{ resolutionBias: photoOutput }], [photoOutput]);
  // The running session (after `onStarted`): its controller knows the active format's real zoom range, and how iOS
  // displays its zoom (`displayableZoomFactor / zoom`: where the front camera's 1× is on iPhones that can expand it).
  const [running, setRunning] = useState<{ deviceId: string; minZoom: number; maxZoom: number; multiplier: number } | null>(null);
  const session = running && device && running.deviceId === device.id ? running : null;
  useEffect(() => {
    // Warms up the capture pipeline once the outputs are configured, so the first "quality" shot doesn't pay for it.
    if (session) photoOutput.prepareSettings([captureSettings(flash)]).catch(() => {});
  }, [session, photoOutput, flash]);

  const warned = useRef(false);
  const onError = useCallback((error: Error) => {
    // A rejected zoom or a session hiccup: not worth an error screen (or LogBox), but worth one line in the log.
    if (warned.current) return;
    warned.current = true;
    console.warn(`Cámara: ${error.message}`);
  }, []);

  function onStarted() {
    if (!device) return;
    const controller = camera.current?.controller;
    if (!controller) return;
    const multiplier = controller.zoom > 0 ? controller.displayableZoomFactor / controller.zoom : 1;
    setRunning({ deviceId: device.id, minZoom: controller.minZoom, maxZoom: controller.maxZoom, multiplier });
  }

  return { camera, device, photoOutput, outputs, constraints, session, onStarted, onError };
}
