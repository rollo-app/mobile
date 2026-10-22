import { requireNativeView, requireOptionalNativeModule } from "expo";
import { SymbolView, type SFSymbol } from "expo-symbols";
import type { ComponentType } from "react";
import type { ColorValue, ViewProps } from "react-native";

export type LockPhase = "locked" | "unlocking" | "camera";

export type RolloLockViewProps = ViewProps & {
  phase: LockPhase;
  /** Point size of the symbol. */
  size?: number;
  tint?: ColorValue;
};

/** The SF Symbol shown for each phase (the native view uses the same ones). */
export const LOCK_SYMBOLS: Record<LockPhase, SFSymbol> = {
  locked: "lock.fill",
  unlocking: "lock.open.fill",
  camera: "camera.fill",
};

/** The native view, or null when this build doesn't include the module (e.g. an older dev build). */
function loadNativeLock(): ComponentType<RolloLockViewProps> | null {
  if (!requireOptionalNativeModule("RolloSymbol")) return null;
  try {
    return requireNativeView<RolloLockViewProps>("RolloSymbol");
  } catch {
    return null;
  }
}

const NativeLock = loadNativeLock();

/**
 * SF Symbol lock that opens and turns into a camera (native SwiftUI, iOS only). Without the native
 * module it shows the same symbol with `expo-symbols`, without the magic replace.
 */
export function RolloLockView({ phase, size = 96, tint, ...rest }: RolloLockViewProps) {
  if (NativeLock) return <NativeLock phase={phase} size={size} tint={tint} {...rest} />;
  return <SymbolView name={LOCK_SYMBOLS[phase]} size={size} tintColor={tint} {...rest} />;
}
