import type { ReactNode } from "react";
import { colors } from "./theme.ts";

export type TabId = "roll" | "map" | "camera" | "friends" | "me";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

// Simple stroke glyphs in the spirit of SF Symbols, 40x40 box.
const GLYPHS: Record<string, ReactNode> = {
  roll: (
    <>
      <rect x="6" y="8" width="28" height="24" rx="5" {...S} />
      <path d="M6 16h28M13 8v8M20 8v8M27 8v8" {...S} />
    </>
  ),
  gallery: (
    <>
      <rect x="6" y="9" width="28" height="22" rx="4" {...S} />
      <circle cx="14" cy="17" r="2.600" {...S} />
      <path d="M7 28l8-7 6 5 4-3 8 6" {...S} />
    </>
  ),
  map: (
    <>
      <path d="M20 35s-10-9-10-17a10 10 0 0 1 20 0c0 8-10 17-10 17Z" {...S} />
      <circle cx="20" cy="18" r="3.600" {...S} />
    </>
  ),
  camera: (
    <>
      <path d="M5 14a4 4 0 0 1 4-4h3l2.500-3h11L28 10h3a4 4 0 0 1 4 4v15a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z" {...S} />
      <circle cx="20" cy="21" r="6.500" {...S} />
    </>
  ),
  play: <path d="M14 9.500v21a1 1 0 0 0 1.500.9l17-10.500a1 1 0 0 0 0-1.800L15.500 8.600A1 1 0 0 0 14 9.500Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  friends: (
    <>
      <circle cx="15" cy="14" r="5.500" {...S} />
      <path d="M4.500 33c0-6 4.700-9.500 10.500-9.500S25.500 27 25.500 33" {...S} />
      <path d="M26 9a5 5 0 0 1 0 10M30 24c3.500 1 5.500 4 5.500 8" {...S} />
    </>
  ),
  me: (
    <>
      <circle cx="20" cy="14" r="6.500" {...S} />
      <path d="M7 35c0-7 5.800-11 13-11s13 4 13 11" {...S} />
    </>
  ),
};

export const TabBar = ({ active, revealed = false }: { active: TabId; revealed?: boolean }) => {
  const tabs: { id: TabId; glyph: string }[] = [
    { id: "roll", glyph: revealed ? "gallery" : "roll" },
    { id: "map", glyph: "map" },
    { id: "camera", glyph: revealed ? "play" : "camera" },
    { id: "friends", glyph: "friends" },
    { id: "me", glyph: "me" },
  ];
  return (
    <div
      style={{
        position: "absolute", left: 28, right: 28, bottom: 44, height: 112, borderRadius: 56,
        display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 8px",
        backgroundColor: "rgba(44,44,46,0.62)", backdropFilter: "blur(30px) saturate(180%)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.14), 0 10px 30px rgba(0,0,0,0.45)", zIndex: 40,
      }}
    >
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <div
            key={t.id}
            style={{
              width: 92, height: 88, borderRadius: 44, display: "flex", alignItems: "center", justifyContent: "center",
              color: on ? colors.tint : colors.secondaryLabel, backgroundColor: on ? "rgba(120,120,128,0.28)" : "transparent",
            }}
          >
            <svg width="56" height="56" viewBox="0 0 40 40">{GLYPHS[t.glyph]}</svg>
          </div>
        );
      })}
    </div>
  );
};
