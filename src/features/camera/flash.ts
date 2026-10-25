export type FlashMode = "auto" | "on" | "off";

/** The flash button rotates automático → prendido → apagado → automático. */
export function nextFlash(mode: FlashMode): FlashMode {
  return mode === "auto" ? "on" : mode === "on" ? "off" : "auto";
}

export const flashSymbol: Record<FlashMode, "bolt.badge.automatic" | "bolt.fill" | "bolt.slash.fill"> = {
  auto: "bolt.badge.automatic",
  on: "bolt.fill",
  off: "bolt.slash.fill",
};

export const flashLabel: Record<FlashMode, string> = {
  auto: "Flash automático",
  on: "Flash prendido",
  off: "Flash apagado",
};
