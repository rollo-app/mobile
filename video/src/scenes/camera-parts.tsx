import type { ReactNode } from "react";
import { colors } from "../ui/theme.ts";

export const BOX_TOP = 190;
export const BOX_H = 720;

const S = { fill: "none", stroke: "#fff", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Glyph = ({ children }: { children: ReactNode }) => (
  <svg width="44" height="44" viewBox="0 0 40 40">{children}</svg>
);

/** Top-right controls: flash, timer, grid. */
export const TopGlyphs = () => (
  <div style={{ display: "flex", gap: 36 }}>
    <Glyph><path d="M22 5 11 22h8l-2 13 12-18h-8Z" {...S} /></Glyph>
    <Glyph><circle cx="20" cy="23" r="12" {...S} /><path d="M20 23V16M16 6h8" {...S} /></Glyph>
    <Glyph><rect x="6" y="6" width="28" height="28" rx="4" {...S} /><path d="M15 6v28M25 6v28M6 15h28M6 25h28" {...S} strokeWidth={1.8} /></Glyph>
  </div>
);

export const TopBar = ({ right }: { right?: ReactNode }) => (
  <div
    style={{
      position: "absolute", top: 118, left: 0, right: 0, height: 56, display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: "0 36px", fontSize: 34, color: "#fff",
    }}
  >
    <span>Cerrar</span>
    {right}
  </div>
);

export const Shutter = ({ press }: { press: number }) => (
  <div
    style={{
      position: "absolute", left: 270 - 76, top: 1040 - 76, width: 152, height: 152, borderRadius: 76,
      border: "6px solid #fff", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
    }}
  >
    <div style={{ width: 122, height: 122, borderRadius: 61, backgroundColor: "#fff", transform: `scale(${press})` }} />
  </div>
);

export const FlipButton = () => (
  <div style={{ position: "absolute", right: 56, top: 1040 - 40, width: 80, height: 80, borderRadius: 40, backgroundColor: colors.fill, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <svg width="48" height="48" viewBox="0 0 40 40">
      <path d="M8 17a12 12 0 0 1 21-6M32 23a12 12 0 0 1-21 6" {...S} />
      <path d="M30 5v7h-7M10 35v-7h7" {...S} />
    </svg>
  </div>
);
