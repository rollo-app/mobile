import { useState } from "react";
import { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import type { CameraDevice, usePhotoOutput } from "react-native-vision-camera";
import { easeOut } from "@/ui/motion";
import type { CapturedPhoto } from "./captured-photo";
import { ensureFourThree } from "./crop-photo";
import { uprightSize } from "./device";
import type { FlashMode } from "./flash";
import { captureSettings } from "./use-camera-session";

/** The shot: capture → temp file → 4:3 (and mirrored when it's the front camera), with the shutter blink. */
export function useTakePhoto(args: {
  photoOutput: ReturnType<typeof usePhotoOutput>;
  device: CameraDevice | undefined;
  flash: FlashMode;
  onCapture: (photo: CapturedPhoto) => void;
}) {
  const { photoOutput, device, flash, onCapture } = args;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const blink = useSharedValue(0);
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.get() }));

  async function shoot() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    // The preview blinks at the instant of the shot, like the iPhone's camera (opacity only: also with Reduce Motion).
    blink.set(withSequence(withTiming(1, { duration: 40 }), withTiming(0, { duration: 220, easing: easeOut() })));
    try {
      const photo = await photoOutput.capturePhoto(captureSettings(flash), {});
      let shot: CapturedPhoto;
      // The front preview is mirrored: the photo comes out the same. When the camera already mirrored it (EXIF), as is.
      const mirror = device?.position === "front" && !photo.isMirrored;
      try {
        const path = await photo.saveToTemporaryFileAsync();
        shot = { uri: path.startsWith("file://") ? path : `file://${path}`, ...uprightSize(photo.width, photo.height, photo.orientation) };
      } finally {
        photo.dispose();
      }
      onCapture(await ensureFourThree(shot, { mirror }));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return { busy, failed, shoot, blinkStyle };
}
