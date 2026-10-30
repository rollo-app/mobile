import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { colors, fonts } from "./theme.ts";

const StatusBar = ({ showClock }: { showClock: boolean }) => (
  <div
    style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 102, display: "flex",
      justifyContent: "space-between", alignItems: "center", padding: "10px 52px 0 62px",
      color: colors.label, fontFamily: fonts.sans, zIndex: 50, pointerEvents: "none",
    }}
  >
    <span style={{ fontSize: 31, fontWeight: 600, letterSpacing: -0.3, opacity: showClock ? 1 : 0 }}>9:41</span>
    <svg width="104" height="28" viewBox="0 0 104 28" fill="#fff">
      <rect x="0" y="18" width="5" height="8" rx="1.5" />
      <rect x="8" y="13" width="5" height="13" rx="1.5" />
      <rect x="16" y="8" width="5" height="18" rx="1.5" />
      <rect x="24" y="2" width="5" height="24" rx="1.5" />
      <path d="M52 8c4 0 7.600 1.500 10.400 4l-2.200 2.400C57.900 12.500 55 11.200 52 11.200s-5.900 1.300-8.200 3.200L41.600 12C44.400 9.500 48 8 52 8Zm0 7c2.200 0 4.200.8 5.800 2.200l-2.200 2.400c-1-.8-2.200-1.300-3.600-1.300s-2.600.5-3.600 1.300l-2.200-2.400C47.800 15.800 49.800 15 52 15Zm0 6.200c1 0 1.800.4 2.500 1L52 25l-2.500-2.800c.7-.6 1.500-1 2.500-1Z" />
      <rect x="72" y="3" width="29" height="21" rx="6" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="2" />
      <rect x="75" y="6" width="23" height="15" rx="3.500" />
      <path d="M103 10v7c1.400-.5 2.200-1.800 2.200-3.500S104.400 10.500 103 10Z" fillOpacity="0.5" />
    </svg>
  </div>
);

export const Screen = ({ children, style, showClock = true }: { children?: ReactNode; style?: CSSProperties; showClock?: boolean }) => (
  <AbsoluteFill style={{ backgroundColor: colors.background, fontFamily: fonts.sans, color: colors.label, overflow: "hidden", ...style }}>
    {children}
    <StatusBar showClock={showClock} />
    <div
      style={{
        position: "absolute", bottom: 14, left: "50%", marginLeft: -68, width: 136, height: 10,
        borderRadius: 5, backgroundColor: colors.label, opacity: 0.9, zIndex: 60,
      }}
    />
  </AbsoluteFill>
);
