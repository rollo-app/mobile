/**
 * SkSL sources for the darkroom reveal. Kept as plain strings so they can be compiled by
 * Skia on the phone and checked with CanvasKit on the computer.
 */

const HASH = `
float hash(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
`;

/** Full-screen film grain over a flat color. `strength` 0 turns the grain off. */
export const GRAIN_SKSL = `
uniform float time;
uniform float strength;
uniform float3 base;
${HASH}
half4 main(float2 xy) {
  float n = hash(floor(xy / 1.5) + floor(time * 24.0) * float2(17.0, 31.0));
  float3 col = base + (n - 0.5) * 0.12 * strength * float3(1.0, 0.35, 0.3);
  return half4(half3(col), 1.0);
}
`;

/**
 * One developing photo. `progress` 0 → 1: the image emerges from its ThumbHash color through a
 * noisy threshold that advances from the edges to the center, in sepia first and then in color,
 * with grain that fades out as it develops.
 */
export const DEVELOP_SKSL = `
uniform shader image;
uniform float2 size;
uniform float progress;
uniform float time;
uniform float3 base;
${HASH}
half4 main(float2 xy) {
  float2 uv = xy / size;
  float2 d = abs(uv - 0.5) * 2.0;
  float center = 1.0 - max(d.x, d.y);
  float n = noise(xy / 18.0) * 0.6 + noise(xy / 5.0) * 0.4;
  float threshold = center * 0.55 + n * 0.45;
  float developed = smoothstep(threshold - 0.12, threshold + 0.02, progress * 1.15);

  half4 c = image.eval(xy);
  float lum = dot(float3(c.rgb), float3(0.299, 0.587, 0.114));
  float3 sepia = float3(lum * 1.07, lum * 0.74, lum * 0.43);
  float3 photo = mix(sepia, float3(c.rgb), smoothstep(0.55, 1.0, progress));
  float3 col = mix(base, photo, developed);

  float grain = hash(floor(xy / 1.2) + floor(time * 24.0) * float2(13.0, 7.0)) - 0.5;
  col += grain * 0.22 * (1.0 - progress);
  return half4(half3(col), 1.0);
}
`;
