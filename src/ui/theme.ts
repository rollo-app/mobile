import { Color } from "expo-router";
import { Platform, type ColorValue, type TextStyle } from "react-native";

/**
 * Tokens de diseño. La app usa los colores y la tipografía del sistema (iOS):
 * se adaptan solos a claro/oscuro y a la accesibilidad. La personalidad va en
 * pocos detalles (epígrafes en serif, la hoja de contacto del rollo), no acá.
 */

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
  danger: pick(Color.ios.systemRed, "#FF3B30"),
  /** Cuadros del rollo que todavía nadie ve. */
  latent: pick(Color.ios.systemGray5, "#E5E5EA"),
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 20, xl: 32 } as const;

export const radius = { sm: 10, md: 14, lg: 22, full: 9999 } as const;

/** Rampa de texto de Apple (tamaños de Dynamic Type por defecto). */
export const type = {
  largeTitle: { fontSize: 34, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "700" },
  headline: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 17 },
  callout: { fontSize: 16 },
  subhead: { fontSize: 15 },
  footnote: { fontSize: 13 },
  caption: { fontSize: 12 },
  /** Los epígrafes: la voz de la gente, en la serif del sistema (New York). */
  quote: { fontSize: 19, lineHeight: 25, fontFamily: Platform.select({ ios: "ui-serif", default: "serif" }) },
} as const satisfies Record<string, TextStyle>;
