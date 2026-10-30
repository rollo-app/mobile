import { colors, fonts } from "./theme.ts";

export const Segmented = ({ items, active, width = 0 }: { items: string[]; active: number; width?: number }) => (
  <div
    style={{
      display: "flex", padding: 4, borderRadius: 18, backgroundColor: colors.fill, height: 64,
      width: width || undefined, fontFamily: fonts.sans, boxSizing: "border-box",
    }}
  >
    {items.map((label, i) => (
      <div
        key={label}
        style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 15,
          fontSize: 26, fontWeight: 600, color: colors.label,
          backgroundColor: i === active ? "#636366" : "transparent",
          boxShadow: i === active ? "0 3px 8px rgba(0,0,0,0.12), 0 3px 1px rgba(0,0,0,0.04)" : undefined,
        }}
      >
        {label}
      </div>
    ))}
  </div>
);
