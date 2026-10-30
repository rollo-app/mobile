import type { ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CAMERA_VIEW } from "../selection.ts";
import { Photo } from "../ui/Photo.tsx";
import { Screen } from "../ui/Screen.tsx";
import { colors, fonts } from "../ui/theme.ts";

const EXIT = Easing.bezier(0.23, 1, 0.32, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const BOX_TOP = 190;
const BOX_H = 720;
const SHUTTER_AT = 40;
const CAPTION_AT = 46;
const SEND_PRESS_AT = 90;
const FLY_AT = 100;

const S = { fill: "none", stroke: "#fff", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const Glyph = ({ children }: { children: ReactNode }) => (
  <svg width="44" height="44" viewBox="0 0 40 40">{children}</svg>
);

const Chip = ({ label, active }: { label: string; active?: boolean }) => (
  <div
    style={{
      width: active ? 72 : 64, height: active ? 72 : 64, borderRadius: 40, backgroundColor: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: active ? 26 : 24, fontWeight: 600,
      color: active ? colors.tint : "#fff", fontFamily: fonts.sans,
    }}
  >
    {label}
  </div>
);

const Viewfinder = ({ frame }: { frame: number }) => {
  const { fps } = useVideoConfig();
  const zoom = interpolate(frame, [0, SHUTTER_AT], [1, 1.04], clamp);
  const press = interpolate(frame, [SHUTTER_AT - 2, SHUTTER_AT + 1, SHUTTER_AT + 5], [1, 0.9, 1], clamp);
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 12 });
  return (
    <AbsoluteFill style={{ opacity: enter }}>
      <div style={{ position: "absolute", top: BOX_TOP, left: 0, width: 540, height: BOX_H, overflow: "hidden" }}>
        <div style={{ width: "100%", height: "100%", transform: `scale(${zoom})` }}>
          <Photo id={CAMERA_VIEW} />
        </div>
        <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 14 }}>
          <Chip label="0,5" />
          <Chip label="1×" active />
          <Chip label="2" />
        </div>
      </div>
      <div
        style={{
          position: "absolute", top: 118, left: 0, right: 0, height: 56, display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "0 36px", fontSize: 34, color: "#fff",
        }}
      >
        <span>Cerrar</span>
        <div style={{ display: "flex", gap: 36 }}>
          <Glyph><path d="M22 5 11 22h8l-2 13 12-18h-8Z" {...S} /></Glyph>
          <Glyph><circle cx="20" cy="23" r="12" {...S} /><path d="M20 23V16M16 6h8" {...S} /></Glyph>
          <Glyph><rect x="6" y="6" width="28" height="28" rx="4" {...S} /><path d="M15 6v28M25 6v28M6 15h28M6 25h28" {...S} strokeWidth={1.8} /></Glyph>
        </div>
      </div>
      <div
        style={{
          position: "absolute", left: 270 - 76, top: 1040 - 76, width: 152, height: 152, borderRadius: 76,
          border: "6px solid #fff", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <div style={{ width: 122, height: 122, borderRadius: 61, backgroundColor: "#fff", transform: `scale(${press})` }} />
      </div>
      <div style={{ position: "absolute", right: 56, top: 1040 - 40, width: 80, height: 80, borderRadius: 40, backgroundColor: colors.fill, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="48" height="48" viewBox="0 0 40 40">
          <path d="M8 17a12 12 0 0 1 21-6M32 23a12 12 0 0 1-21 6" {...S} />
          <path d="M30 5v7h-7M10 35v-7h7" {...S} />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

const CaptionScreen = ({ frame }: { frame: number }) => {
  const { fps } = useVideoConfig();
  const local = frame - CAPTION_AT;
  const enter = spring({ frame: local, fps, config: { damping: 200 }, durationInFrames: 12 });
  const fly = interpolate(frame, [FLY_AT, 120], [0, 1], { ...clamp, easing: EXIT });
  const press = interpolate(frame, [SEND_PRESS_AT - 1, SEND_PRESS_AT + 2, SEND_PRESS_AT + 6], [1, 0.96, 1], clamp);
  // Photo flies from its slot toward the bottom-center (camera tab).
  const photoW = 460;
  const photoH = Math.round((photoW * 4) / 3);
  const photoTop = 160;
  const dy = (1075 - (photoTop + photoH / 2)) * fly;
  const scale = 1 - 0.86 * fly;
  const photoOpacity = 1 - interpolate(frame, [FLY_AT + 6, 120], [0, 1], clamp);
  const uiOpacity = enter * (1 - interpolate(frame, [FLY_AT, FLY_AT + 8], [0, 1], { ...clamp, easing: EXIT }));
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", opacity: enter }}>
      <div style={{ opacity: uiOpacity, position: "absolute", top: 118, left: 36, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.fill, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="28" height="28" viewBox="0 0 28 28"><path d="M6 6l16 16M22 6 6 22" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></svg>
      </div>
      <div
        style={{
          position: "absolute", top: photoTop + 40, left: (540 - photoW) / 2, width: photoW, height: photoH, borderRadius: 24,
          overflow: "hidden", opacity: photoOpacity, transform: `translateY(${dy}px) scale(${scale})`,
        }}
      >
        <Photo id={CAMERA_VIEW} blur={70} style={{ transform: "scale(1.5)" }} />
      </div>
      <div style={{ opacity: uiOpacity }}>
        <div
          style={{
            position: "absolute", top: photoTop + 40 + photoH + 28, left: 40, right: 40, fontFamily: fonts.serif,
            fontSize: 34, color: colors.secondaryLabel, textAlign: "center",
          }}
        >
          Agregá un caption
        </div>
        <div
          style={{
            position: "absolute", left: 40, right: 40, bottom: 76, height: 100, borderRadius: 28, backgroundColor: colors.tint,
            color: colors.onTint, fontSize: 34, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center",
            transform: `scale(${press})`,
          }}
        >
          Mandar al rollo
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const CameraScene = () => {
  const frame = useCurrentFrame();
  const flash = interpolate(frame, [SHUTTER_AT, SHUTTER_AT + 2, CAPTION_AT + 4], [0, 0.6, 0], clamp);
  return (
    <Screen>
      {frame < CAPTION_AT ? <Viewfinder frame={frame} /> : <CaptionScreen frame={frame} />}
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash, zIndex: 70 }} />
    </Screen>
  );
};
