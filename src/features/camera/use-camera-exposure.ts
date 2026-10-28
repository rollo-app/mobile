import { useEffect, useState, type RefObject } from "react";
import type { AccessibilityActionEvent } from "react-native";
import { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import type { CameraDevice, CameraRef } from "react-native-vision-camera";
import { easeOut } from "@/ui/motion";
import { biasRange, meteringModes, stepBias } from "./exposure";

/** The focus square dims this long after the last touch, like the iPhone's. */
const FOCUS_DIM_MS = 2000;

type FocusPoint = { deviceId: string; x: number; y: number };

/**
 * Exposure: a tap meters there (focus + exposure + white balance) and resets the bias; dragging afterwards biases it.
 * Both belong to one device: flipping (or remounting) starts over with no point and 0 EV.
 */
export function useCameraExposure(args: {
  camera: RefObject<CameraRef | null>;
  device: CameraDevice | undefined;
  reduceMotion: boolean | null | undefined;
}) {
  const { camera, device, reduceMotion } = args;
  const focusScale = useSharedValue(1);
  const focusOpacity = useSharedValue(1);
  const focusStyle = useAnimatedStyle(() => ({ opacity: focusOpacity.get(), transform: [{ scale: focusScale.get() }] }));

  const range = device ? biasRange(device) : null;
  const [focusState, setFocusState] = useState<FocusPoint | null>(null);
  const focus = focusState && device && focusState.deviceId === device.id ? focusState : null;
  const [biasState, setBiasState] = useState<{ deviceId: string; bias: number } | null>(null);
  const bias = biasState && device && biasState.deviceId === device.id ? biasState.bias : 0;
  useEffect(() => {
    if (!focus) return;
    focusOpacity.set(1);
    const t = setTimeout(() => focusOpacity.set(withTiming(0.5, { duration: 300, easing: easeOut() })), FOCUS_DIM_MS);
    return () => clearTimeout(t);
  }, [focus, bias]); // eslint-disable-line react-hooks/exhaustive-deps -- the shared value is stable

  function setBias(next: number) {
    if (device) setBiasState({ deviceId: device.id, bias: next });
  }

  function focusAt(x: number, y: number) {
    if (!device) return;
    setFocusState({ deviceId: device.id, x, y });
    setBias(0);
    focusScale.set(reduceMotion === false ? withSequence(withTiming(1.25, { duration: 0 }), withTiming(1, { duration: 200, easing: easeOut() })) : 1);
    const modes = meteringModes(device);
    if (modes.length === 0) return;
    try {
      camera.current?.focusTo({ x, y }, { modes, autoResetAfter: null }).catch(() => {});
    } catch {
      // Not running yet: the square still shows where the user tapped.
    }
  }

  function onExposureAction(event: AccessibilityActionEvent) {
    if (!range) return;
    const { actionName } = event.nativeEvent;
    if (actionName === "increment") setBias(stepBias(range, bias, 1));
    if (actionName === "decrement") setBias(stepBias(range, bias, -1));
  }

  return { range, focus, bias, setBias, focusAt, onExposureAction, focusStyle };
}
