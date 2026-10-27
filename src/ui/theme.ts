import { Color } from "expo-router";
import { DynamicColorIOS, Platform, type ColorValue, type TextStyle } from "react-native";

/**
 * Design tokens. The app uses the system colors and typography (iOS):
 * they adapt on their own to light/dark and accessibility. Personality lives in
 * a few details (serif captions, the roll's contact sheet), not here.
 */

/** Cobalt as fixed hex, for things that don't accept dynamic colors (MapLibre, Android controls). */
export const tintHex = { light: "#3155F5", dark: "#5C7CFF" } as const;

const pick = (ios: ColorValue, fallback: string): ColorValue => Platform.select({ ios, default: fallback })!;

export const colors = {
  label: pick(Color.ios.label, "#000000"),
  secondaryLabel: pick(Color.ios.secondaryLabel, "#3C3C4399"),
  tertiaryLabel: pick(Color.ios.tertiaryLabel, "#3C3C434D"),
  separator: pick(Color.ios.separator, "#3C3C434A"),
  background: pick(Color.ios.systemBackground, "#FFFFFF"),
  groupedBackground: pick(Color.ios.systemGroupedBackground, "#F2F2F7"),
  cell: pick(Color.ios.secondarySystemGroupedBackground, "#FFFFFF"),
  fill: pick(Color.ios.tertiarySystemFill, "#7676801F"),
  /** Brand cobalt: the system accent. Only on actions and selections, never as fill. */
  tint: pick(DynamicColorIOS(tintHex), tintHex.light),
  /** Text on a cobalt background. */
  onTint: "#FFFFFF",
  danger: pick(Color.ios.systemRed, "#FF3B30"),
  /** Roll frames that nobody sees yet. */
  latent: pick(Color.ios.systemGray5, "#E5E5EA"),
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 20, xl: 32 } as const;

/**
 * Fixed sizes for controls drawn over a screen, under its (translucent) navigation header.
 * `headerHeight` is the iOS navigation bar without the status bar: add `insets.top`.
 * `controlsRowHeight` is the row of controls under the header (segmented control, filter pill).
 */
export const layout = { headerHeight: 44, controlsRowHeight: 34 } as const;

export const radius = { sm: 10, md: 14, lg: 22, full: 9999 } as const;

/** Apple's text ramp (default Dynamic Type sizes). */
export const type = {
  largeTitle: { fontSize: 34, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "700" },
  title3: { fontSize: 20, fontWeight: "600" },
  headline: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 17 },
  callout: { fontSize: 16 },
  subhead: { fontSize: 15 },
  footnote: { fontSize: 13 },
  caption: { fontSize: 12 },
  /** Captions: people's voice, in the system serif (New York). */
  quote: { fontSize: 19, lineHeight: 25, fontFamily: Platform.select({ ios: "ui-serif", default: "serif" }) },
} as const satisfies Record<string, TextStyle>;
