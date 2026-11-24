import {
  Blur,
  Canvas,
  Group,
  ImageShader,
  Paint,
  Rect,
  Shader,
  Skia,
  rect,
  useClock,
  type SkImage,
  type SkRuntimeEffect,
} from "@shopify/react-native-skia";
import { Image } from "expo-image";
import { useMemo } from "react";
import type { ImageStyle, ViewStyle } from "react-native";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import { thumbHashAverageColor } from "@/features/trips/thumbhash-color";
import { cellFill } from "./cell-fill";
import { DEVELOP_SKSL } from "./darkroom-shaders";

const FALLBACK_BASE = [0.25, 0.22, 0.2];

/**
 * One photo "developing": noise threshold from the edges, sepia to color, blur 20 to 0, driven by
 * `progress` (0 = the ThumbHash-like blur in sepia, 1 = the sharp photo). Own Skia canvas; the
 * darkroom intro draws many of them on one canvas through `DevelopLayer`. If the shader didn't
 * compile or the thumb didn't decode, it falls back to a plain `expo-image` (no effect).
 */
export function DevelopImage({
  thumbBytes,
  uri,
  headers,
  progress,
  size,
  style,
  thumbhash = null,
}: {
  /** The downloaded thumb, decoded here; null while there is none. */
  thumbBytes: ArrayBuffer | null;
  /** The photo to show as is when the effect can't be drawn. */
  uri: string | null;
  /** Sent with `uri` (the session's Bearer: media needs it). */
  headers?: Record<string, string>;
  progress: SharedValue<number>;
  size: { width: number; height: number };
  style?: ViewStyle;
  /** Optional: tints the not-yet-developed state with the photo's average color. */
  thumbhash?: string | null;
}) {
  const image = useMemo(() => decodeThumb(thumbBytes), [thumbBytes]);
  const effect = useMemo(() => Skia.RuntimeEffect.Make(DEVELOP_SKSL), []);
  const clock = useClock();
  const box: ViewStyle = { width: size.width, height: size.height, overflow: "hidden", ...style };

  if (!image || !effect) {
    return uri ? <Image source={{ uri, headers }} style={box as ImageStyle} contentFit="cover" /> : null;
  }
  return (
    <Canvas style={box}>
      <DevelopLayer effect={effect} image={image} thumbhash={thumbhash} size={size.width} height={size.height} progress={progress} clock={clock} />
    </Canvas>
  );
}

export function decodeThumb(bytes: ArrayBuffer | null): SkImage | null {
  if (!bytes) return null;
  return Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(bytes)));
}

/**
 * The Skia content of a developing photo, to draw inside a `Canvas` (the intro puts a grid of them
 * in one). `progress` is already eased and delayed by the caller; `x`/`y` place it on the canvas.
 */
export function DevelopLayer({
  effect,
  image,
  thumbhash,
  x = 0,
  y = 0,
  size,
  height = size,
  progress,
  clock,
}: {
  effect: SkRuntimeEffect | null;
  image: SkImage | null;
  thumbhash: string | null;
  x?: number;
  y?: number;
  size: number;
  height?: number;
  progress: SharedValue<number>;
  clock: SharedValue<number>;
}) {
  const avg = thumbhash ? thumbHashAverageColor(thumbhash) : null;
  const base = avg ? [avg.r / 255, avg.g / 255, avg.b / 255] : FALLBACK_BASE;

  const uniforms = useDerivedValue(() => ({
    size: [size, height],
    progress: progress.value,
    time: clock.value / 1000,
    base,
  }));
  const blur = useDerivedValue(() => 20 * (1 - progress.value));
  const bounds = rect(0, 0, size, height);
  const fill = cellFill(!!effect, !!image);

  return (
    <Group
      transform={[{ translateX: x }, { translateY: y }]}
      clip={bounds}
      layer={
        <Paint>
          <Blur blur={blur} mode="clamp" />
        </Paint>
      }
    >
      {fill === "develop" && image && effect ? (
        <Rect rect={bounds}>
          <Shader source={effect} uniforms={uniforms}>
            <ImageShader image={image} fit="cover" rect={bounds} />
          </Shader>
        </Rect>
      ) : fill === "image" && image ? (
        <Rect rect={bounds}>
          <ImageShader image={image} fit="cover" rect={bounds} />
        </Rect>
      ) : (
        <Rect rect={bounds} color={Skia.Color(`rgb(${base.map((c) => Math.round(c * 255)).join(",")})`)} />
      )}
    </Group>
  );
}
