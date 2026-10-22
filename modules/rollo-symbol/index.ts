import { requireNativeView } from "expo";
import type { ColorValue, ViewProps } from "react-native";

export type LockPhase = "locked" | "unlocking" | "camera";

export type RolloLockViewProps = ViewProps & {
  phase: LockPhase;
  /** Point size of the symbol. */
  size?: number;
  tint?: ColorValue;
};

/** SF Symbol lock that opens and turns into a camera (native SwiftUI, iOS only). */
export const RolloLockView = requireNativeView<RolloLockViewProps>("RolloSymbol");
