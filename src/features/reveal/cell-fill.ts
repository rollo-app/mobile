export type CellFill = "develop" | "image" | "color";

/**
 * What a developing cell draws: the photo through the develop shader, the photo as is when the
 * shader didn't compile on this phone (`RuntimeEffect.Make` returned null), or its ThumbHash color
 * while the photo loads.
 */
export function cellFill(hasEffect: boolean, hasImage: boolean): CellFill {
  if (!hasImage) return "color";
  return hasEffect ? "develop" : "image";
}
