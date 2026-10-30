import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { PEOPLE } from "../cast.ts";
import { GALLERY, PROFILE_AVATAR } from "../selection.ts";
import { Avatar } from "../ui/Avatar.tsx";
import { Photo } from "../ui/Photo.tsx";
import { Screen } from "../ui/Screen.tsx";
import { Segmented } from "../ui/Segmented.tsx";
import { TabBar } from "../ui/TabBar.tsx";
import { colors, fonts, type } from "../ui/theme.ts";

const juani = PEOPLE.find((p) => p.id === "juani")!;
const GAP = 4;
const CELL = (540 - 2 * GAP) / 3;
const FEATURED = [GALLERY[3]!, GALLERY[6]!, GALLERY[9]!, GALLERY[11]!, GALLERY[14]!, GALLERY[16]!];
const LANDING = GALLERY[0]!;
const LAND_AT = 45;
const EXIT = Easing.bezier(0.23, 1, 0.32, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const ProfileScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const land = spring({ frame: frame - LAND_AT, fps, config: { damping: 200 }, durationInFrames: 12 });
  const pillIn = interpolate(frame, [LAND_AT + 6, LAND_AT + 12], [0, 1], { ...clamp, easing: EXIT });
  const pillOut = interpolate(frame, [LAND_AT + 36, LAND_AT + 44], [1, 0], { ...clamp, easing: EXIT });
  const pill = Math.min(pillIn, pillOut);
  return (
    <Screen>
      <AbsoluteFill style={{ top: 0 }}>
        <div style={{ position: "absolute", top: 150, left: 32, right: 32, display: "flex", gap: 24, alignItems: "flex-start" }}>
          <Avatar person={juani} size={160} photoId={PROFILE_AVATAR} />
          <div style={{ flex: 1, minWidth: 0, paddingTop: 8 }}>
            <div style={{ ...type.title, fontFamily: fonts.sans }}>Juani</div>
            <div style={{ ...type.footnote, color: colors.secondaryLabel }}>@juani</div>
            <div
              style={{
                display: "inline-block", marginTop: 10, padding: "4px 14px", borderRadius: 14, backgroundColor: colors.fill,
                color: colors.secondaryLabel, fontSize: 22, fontWeight: 600, letterSpacing: 1.5,
              }}
            >
              FOUNDER
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", top: 340, left: 32, right: 32 }}>
          <div style={type.body}>Viajando con amigos.</div>
          <div style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 6 }}>12 amigos · 3 en común</div>
        </div>
        <div style={{ position: "absolute", top: 470, left: 32, right: 32 }}>
          <Segmented items={["Fotos", "Mapa"]} active={0} />
        </div>
        <div style={{ position: "absolute", top: 566, left: 0, right: 0, display: "flex", flexWrap: "wrap", gap: GAP }}>
          {FEATURED.map((id) => (
            <div key={id} style={{ width: CELL, height: CELL }}><Photo id={id} /></div>
          ))}
        </div>
      </AbsoluteFill>
      <LandingCell land={land} />
      <div
        style={{
          position: "absolute", left: "50%", top: 862, transform: `translateX(-50%) translateY(${(1 - pill) * 10}px)`, opacity: pill,
          padding: "14px 32px", borderRadius: 40, backgroundColor: "rgba(44,44,46,0.92)", fontSize: 28, fontWeight: 600,
          whiteSpace: "nowrap", zIndex: 45,
        }}
      >
        Destacada en tu perfil
      </div>
      <TabBar active="me" />
    </Screen>
  );
};

const LandingCell = ({ land }: { land: number }) => (
  <div
    style={{
      position: "absolute", top: 566 + 2 * (CELL + GAP), left: 0, width: CELL, height: CELL, overflow: "hidden",
      opacity: land, transform: `scale(${0.92 + 0.08 * land})`,
    }}
  >
    <Photo id={LANDING} />
  </div>
);
