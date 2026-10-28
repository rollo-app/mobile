import { useRef } from "react";
import type { GestureResponderEvent } from "react-native";
import { dragBias } from "./exposure";
import { pinchZoom, touchDistance } from "./zoom";
import type { useCameraExposure } from "./use-camera-exposure";
import type { useCameraZoom } from "./use-camera-zoom";

/** A finger that moves less than this is a tap (focus), not a gesture. */
const TAP_SLOP = 10;

/**
 * The touch responder over the preview: a tap focuses, two fingers pinch the zoom, and one finger moving up or down
 * after a tap biases the exposure.
 */
export function useCameraTouch(zoomControl: ReturnType<typeof useCameraZoom>, exposure: ReturnType<typeof useCameraExposure>) {
  const { levels, zoom, applyZoom } = zoomControl;
  const { focus, range, bias, setBias, focusAt } = exposure;
  const touch = useRef({ startZoom: 0, startDistance: 0, startBias: 0, x: 0, y: 0, pageX: 0, pageY: 0, gesture: false, pinched: false, exposure: false });

  return {
    onStartShouldSetResponder: () => true,
    onResponderGrant: (e: GestureResponderEvent) => {
      const { touches, locationX, locationY, pageX, pageY } = e.nativeEvent;
      const pinching = touches.length > 1;
      touch.current = {
        startZoom: zoom,
        startDistance: touchDistance(touches),
        startBias: bias,
        x: locationX,
        y: locationY,
        pageX,
        pageY,
        gesture: pinching,
        pinched: pinching,
        exposure: false,
      };
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const { touches } = e.nativeEvent;
      const t = touch.current;
      if (touches.length < 2) {
        // A finger lifted: the next two-finger gesture starts over from the current zoom.
        t.startDistance = 0;
        const [only] = touches;
        if (!only) return;
        const dx = only.pageX - t.pageX;
        const dy = only.pageY - t.pageY;
        if (Math.hypot(dx, dy) > TAP_SLOP) {
          t.gesture = true;
          // One finger moving up or down after a tap is the exposure, like the iPhone (never the end of a pinch).
          if (!t.pinched && focus && range && Math.abs(dy) > Math.abs(dx)) t.exposure = true;
        }
        if (t.exposure && range) setBias(dragBias(range, t.startBias, dy));
        return;
      }
      t.gesture = true;
      t.pinched = true;
      t.exposure = false;
      if (!levels) return;
      if (t.startDistance <= 0) touch.current = { ...t, startZoom: zoom, startDistance: touchDistance(touches) };
      applyZoom(pinchZoom(levels, touch.current.startZoom, touch.current.startDistance, touchDistance(touches)), false);
    },
    onResponderRelease: () => {
      if (touch.current.gesture) return;
      focusAt(touch.current.x, touch.current.y);
    },
  };
}
