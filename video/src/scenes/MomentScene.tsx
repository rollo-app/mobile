import { Lottie, type LottieAnimationData } from "@remotion/lottie";
import { useLayoutEffect, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { formatHour, formatLongDate } from "../format.ts";
import { usePhoto } from "../data/photos-context.tsx";
import { MOMENT_MAIN, MOMENT_SECOND } from "../selection.ts";
import { LivePhoto } from "../ui/LivePhoto.tsx";
import { Photo } from "../ui/Photo.tsx";
import { Screen } from "../ui/Screen.tsx";
import { colors, fonts } from "../ui/theme.ts";
import { BOX_H, BOX_TOP, FlipButton, Shutter, TopBar, TopGlyphs } from "./camera-parts.tsx";

const EXIT = Easing.bezier(0.23, 1, 0.32, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const NOTIFY_AT = 8;
const TAP_AT = 26;
const INTRO_AT = 30;
/** Each viewfinder gets 26 frames of live motion. */
const FINDER_AT = 50;
const SHUTTER_MAIN = FINDER_AT + 26;
const FRONT_AT = SHUTTER_MAIN + 7;
const SHUTTER_FRONT = FRONT_AT + 26;
/** The result (both photos) holds from here to the end of the scene. */
const RESULT_AT = SHUTTER_FRONT + 4;

const GLASS = { backgroundColor: "rgba(40,40,44,0.55)", backdropFilter: "blur(30px) saturate(1.6)" } as const;

/** The "Revelado" logo on the tint square (circles as in scripts/build-icons.mjs, 120×120 box). */
const AppIcon = ({ size }: { size: number }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.225, backgroundColor: "#3155F5", overflow: "hidden", flexShrink: 0 }}>
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="34" fill="#fff" fillOpacity="0.18" />
      <circle cx="66" cy="54" r="24" fill="#fff" fillOpacity="0.38" />
      <circle cx="71" cy="49" r="14" fill="#fff" fillOpacity="1" />
    </svg>
  </div>
);

const LockScreen = ({ frame }: { frame: number }) => {
  const takenAt = usePhoto(MOMENT_MAIN).takenAt;
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - NOTIFY_AT, fps, config: { damping: 200 }, durationInFrames: 14 });
  const press = interpolate(frame, [TAP_AT - 2, TAP_AT + 1, TAP_AT + 5], [1, 0.97, 1], clamp);
  const ripple = interpolate(frame, [TAP_AT, TAP_AT + 10], [0, 1], { ...clamp, easing: EXIT });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <Photo id={MOMENT_MAIN} blur={30} style={{ transform: "scale(1.3)" }} />
        <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.5)" }} />
      </div>
      <div style={{ position: "absolute", top: 150, left: 0, right: 0, textAlign: "center", fontFamily: fonts.sans, color: "rgba(255,255,255,0.85)" }}>
        <div style={{ fontSize: 34, fontWeight: 500 }}>{formatLongDate(takenAt)}</div>
        <div style={{ fontSize: 196, lineHeight: "200px", fontWeight: 200, letterSpacing: -4, color: "rgba(255,255,255,0.95)", marginTop: 4 }}>{formatHour(takenAt)}</div>
      </div>
      <div
        style={{
          position: "absolute", top: 640, left: 24, right: 24, ...GLASS, borderRadius: 52, padding: "26px 28px",
          display: "flex", gap: 24, alignItems: "flex-start", opacity: enter,
          transform: `translateY(${(1 - enter) * -60}px) scale(${press})`,
        }}
      >
        <AppIcon size={84} />
        <div style={{ flex: 1, fontFamily: fonts.sans, color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "rgba(235,235,245,0.6)", letterSpacing: 0.5 }}>
            <span style={{ fontWeight: 600 }}>ROLLO</span>
            <span>ahora</span>
          </div>
          <div style={{ fontSize: 31, fontWeight: 600, marginTop: 6 }}>Es tu momento</div>
          <div style={{ fontSize: 29, lineHeight: "38px", marginTop: 2, color: "rgba(255,255,255,0.92)" }}>
            Tenés 15 minutos para sacar tu foto de Europa.
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute", left: 270 - 40, top: 740 - 40, width: 80, height: 80, borderRadius: 40,
          backgroundColor: "rgba(255,255,255,0.45)", opacity: (1 - ripple) * (frame >= TAP_AT ? 1 : 0), transform: `scale(${0.4 + ripple})`,
        }}
      />
    </AbsoluteFill>
  );
};

const useMomentIntro = () => {
  const [data, setData] = useState<LottieAnimationData | null>(null);
  // Layout effect so the handle exists at commit; released once, also when unmounted early.
  useLayoutEffect(() => {
    let cancelled = false;
    let released = false;
    const handle = delayRender("moment-intro.json");
    const release = () => {
      if (released) return;
      released = true;
      continueRender(handle);
    };
    fetch(staticFile("moment-intro.json"))
      .then((r) => r.json())
      .then((json) => { if (cancelled) return; setData(json); release(); })
      .catch((e) => { if (!cancelled) cancelRender(e); });
    return () => {
      cancelled = true;
      release();
    };
  }, []);
  return data;
};

const Intro = () => {
  const data = useMomentIntro();
  const frame = useCurrentFrame();
  const text = interpolate(frame, [8, 16], [0, 1], { ...clamp, easing: EXIT });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, marginTop: -40 }}>
        <div style={{ width: 440, height: 440 }}>
          {data ? <Lottie animationData={data} playbackRate={2.4} loop={false} style={{ width: 440, height: 440 }} /> : null}
        </div>
        <div style={{ textAlign: "center", fontFamily: fonts.sans, opacity: text, transform: `translateY(${(1 - text) * 12}px)` }}>
          <div style={{ fontSize: 56, lineHeight: "66px", fontWeight: 700, color: "#fff" }}>Tu momento</div>
          <div style={{ fontSize: 34, lineHeight: "44px", color: "rgba(255,255,255,0.75)", marginTop: 6 }}>Te quedan 14:52</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Finder = ({ id, mirror, frame, shutterAt }: { id: string; mirror: boolean; frame: number; shutterAt: number }) => {
  const press = interpolate(frame, [shutterAt - 2, shutterAt + 1, shutterAt + 5], [1, 0.9, 1], clamp);
  const zoom = interpolate(frame, [0, shutterAt], [1, 1.04], clamp);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: BOX_TOP, left: 0, width: 540, height: BOX_H, overflow: "hidden" }}>
        <div style={{ width: "100%", height: "100%", transform: `scale(${zoom})` }}>
          <LivePhoto id={id} mirror={mirror} shutterAt={shutterAt} />
        </div>
      </div>
      <TopBar right={<TopGlyphs />} />
      <Shutter press={press} />
      <FlipButton />
    </AbsoluteFill>
  );
};

const INSET_W = 144;
const INSET_H = Math.round(144 * 1.33);

const Result = ({ frame }: { frame: number }) => {
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 18 });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", opacity: enter }}>
      <div style={{ position: "absolute", top: BOX_TOP, left: 0, width: 540, height: BOX_H, overflow: "hidden", borderRadius: 24 }}>
        <Photo id={MOMENT_MAIN} />
        <div
          style={{
            position: "absolute", top: 20, left: 20, width: INSET_W, height: INSET_H, borderRadius: 20, border: "4px solid #fff",
            boxSizing: "border-box", overflow: "hidden", backgroundColor: "#222",
            transform: `scale(${interpolate(frame, [6, 18], [0.9, 1], { ...clamp, easing: EXIT })})`, transformOrigin: "top left",
          }}
        >
          <Photo id={MOMENT_SECOND} mirror />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const MomentScene = () => {
  const frame = useCurrentFrame();
  const clock = formatHour(usePhoto(MOMENT_MAIN).takenAt);
  const flash = (at: number) => interpolate(frame, [at, at + 2, at + 8], [0, 0.6, 0], clamp);
  const toBlack = interpolate(frame, [INTRO_AT - 4, INTRO_AT], [0, 1], clamp);
  const frontFade = interpolate(frame, [FRONT_AT, FRONT_AT + 6], [0, 1], clamp);
  return (
    <Screen showClock={frame >= INTRO_AT} clock={clock}>
      {frame < INTRO_AT ? <LockScreen frame={frame} /> : null}
      {frame < INTRO_AT ? <AbsoluteFill style={{ backgroundColor: "#000", opacity: toBlack }} /> : null}
      {frame >= INTRO_AT && frame < FINDER_AT ? <Sequence from={INTRO_AT}><Intro /></Sequence> : null}
      {frame >= FINDER_AT && frame < FRONT_AT + 6 ? (
        <Sequence from={FINDER_AT}><Finder id={MOMENT_MAIN} mirror={false} frame={frame - FINDER_AT} shutterAt={SHUTTER_MAIN - FINDER_AT} /></Sequence>
      ) : null}
      {frame >= FRONT_AT && frame < RESULT_AT ? (
        <AbsoluteFill style={{ opacity: frontFade }}>
          <Sequence from={FRONT_AT}><Finder id={MOMENT_SECOND} mirror frame={frame - FRONT_AT} shutterAt={SHUTTER_FRONT - FRONT_AT} /></Sequence>
        </AbsoluteFill>
      ) : null}
      {frame >= RESULT_AT ? <Result frame={frame - RESULT_AT} /> : null}
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: Math.max(flash(SHUTTER_MAIN), flash(SHUTTER_FRONT)), zIndex: 70 }} />
    </Screen>
  );
};
