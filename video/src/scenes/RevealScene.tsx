import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { formatRevealDate } from "../format.ts";
import { REVEAL } from "../selection.ts";
import { Grain } from "../ui/Grain.tsx";
import { Photo } from "../ui/Photo.tsx";
import { Screen } from "../ui/Screen.tsx";
import { fonts } from "../ui/theme.ts";

const EXIT = Easing.bezier(0.23, 1, 0.32, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const DEVELOP_AT = 25;
const HIT_AT = 100;
const CELL_FRAMES = 20;
const STAGGER = 5;
const TITLE_AT = 108;
const SAFELIGHT = "rgb(255, 52, 36)";

const COLS = 3;
const GAP = 8;
const SIDE = 20;
const CELL_W = (540 - SIDE * 2 - GAP * (COLS - 1)) / COLS;
const CELL_H = Math.round((CELL_W * 4) / 3);
const ROWS = REVEAL.length / COLS;
const GRID_H = CELL_H * ROWS + GAP * (ROWS - 1);
const GRID_TOP = 102 + (1170 - 102 - 56 - GRID_H) / 2;

const Cell = ({ id, index, frame }: { id: string; index: number; frame: number }) => {
  const p = interpolate(frame, [DEVELOP_AT + index * STAGGER, DEVELOP_AT + index * STAGGER + CELL_FRAMES], [0, 1], clamp);
  const e = p * p * (3 - 2 * p);
  const blur = 36 * (1 - e);
  const filter = `blur(${blur}px) sepia(${1 - e}) saturate(${0.3 + 0.7 * e}) brightness(${0.6 + 0.4 * e})`;
  return (
    <div
      style={{
        position: "relative", width: CELL_W, height: CELL_H, borderRadius: 10, overflow: "hidden",
        backgroundColor: "#3a0a08",
      }}
    >
      <Photo id={id} style={{ filter, transform: `scale(${1 + 0.4 * (1 - e)})` }} />
      <div style={{ position: "absolute", inset: 0, backgroundColor: SAFELIGHT, mixBlendMode: "multiply", opacity: 0.85 * (1 - e) }} />
    </div>
  );
};

export const RevealScene = () => {
  const frame = useCurrentFrame();
  const darken = interpolate(frame, [HIT_AT, HIT_AT + 12], [0, 1], clamp);
  const safelight = interpolate(frame, [HIT_AT, HIT_AT + 8], [0.8, 0], clamp);
  const flash = interpolate(frame, [HIT_AT, HIT_AT + 2, HIT_AT + 14], [0, 0.9, 0], { ...clamp, easing: EXIT });
  const gridIn = interpolate(frame, [18, 28], [0, 1], clamp);
  const gridDim = interpolate(frame, [TITLE_AT, TITLE_AT + 14], [1, 0.3], { ...clamp, easing: EXIT });
  const developing = interpolate(frame, [0, 8, DEVELOP_AT - 2, DEVELOP_AT + 6], [0, 1, 1, 0], clamp);
  const title = interpolate(frame, [TITLE_AT, TITLE_AT + 12], [0, 1], { ...clamp, easing: EXIT });
  const titleY = (1 - title) * 12;
  return (
    <Screen>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, #2a0000, #5a0606)`, opacity: 1 - darken }} />
      <Grain opacity={0.1 * (1 - darken)} />
      <div
        style={{
          position: "absolute", top: GRID_TOP, left: SIDE, display: "grid", gridTemplateColumns: `repeat(${COLS}, ${CELL_W}px)`,
          gap: GAP, opacity: gridIn * gridDim,
        }}
      >
        {REVEAL.map((id, i) => <Cell key={id} id={id} index={i} frame={frame} />)}
      </div>
      <AbsoluteFill style={{ backgroundColor: SAFELIGHT, mixBlendMode: "multiply", opacity: safelight }} />
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: developing }}>
        <div style={{ fontFamily: fonts.serif, fontSize: 48, color: "rgba(255,196,186,0.9)", textAlign: "center", padding: "0 40px" }}>
          Revelando Europa
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, opacity: title,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.75)", fontFamily: fonts.serif }}>
          Se reveló
        </div>
        <div style={{ fontFamily: fonts.serif, fontSize: 112, lineHeight: "120px", color: "#fff" }}>Europa</div>
        <div style={{ fontSize: 34, color: "rgba(255,255,255,0.75)" }}>{formatRevealDate("2026-07-20T12:00:00+02:00")}</div>
      </AbsoluteFill>
    </Screen>
  );
};
