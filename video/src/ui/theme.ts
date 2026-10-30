// Dark iOS system colors, as the app renders them.
export const colors = {
  background: "#000000",
  secondaryBackground: "#1C1C1E",
  fill: "rgba(118,118,128,0.24)",
  label: "#FFFFFF",
  secondaryLabel: "rgba(235,235,245,0.6)",
  separator: "#38383A",
  tint: "#5C7CFF",
  onTint: "#FFFFFF",
} as const;

export const fonts = {
  sans: '-apple-system, "SF Pro Text", system-ui, sans-serif',
  serif: 'ui-serif, "New York", Georgia, serif',
} as const;

// Render is 540 px wide = 270 pt, so 1 pt = 2 px.
export const type = {
  body: { fontSize: 34, lineHeight: "44px" },
  footnote: { fontSize: 26, lineHeight: "34px" },
  title: { fontSize: 56, lineHeight: "66px", fontWeight: 700 },
} as const;
