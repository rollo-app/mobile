import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { GALLERY } from "../selection.ts";
import { Photo } from "../ui/Photo.tsx";
import { Screen } from "../ui/Screen.tsx";
import { Segmented } from "../ui/Segmented.tsx";
import { TabBar } from "../ui/TabBar.tsx";

const GAP = 4;
const CELL = (540 - 2 * GAP) / 3;
const ROWS = Math.ceil(GALLERY.length / 3);

export const GalleryScene = () => {
  const frame = useCurrentFrame();
  const total = ROWS * (CELL + GAP);
  // ~1.5 screens of travel would need more photos than exist; scroll through the whole grid instead.
  const scroll = interpolate(frame, [0, 90], [0, Math.max(0, total - 800)], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  return (
    <Screen>
      <AbsoluteFill style={{ top: 110 }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, padding: "8px 120px 16px", backgroundColor: "rgba(0,0,0,0.85)" }}>
          <Segmented items={["Galería", "Rollo"]} active={0} />
        </div>
        <div style={{ position: "absolute", top: 100, left: 0, right: 0, display: "flex", flexWrap: "wrap", gap: GAP, transform: `translateY(${-scroll}px)` }}>
          {GALLERY.map((id) => (
            <div key={id} style={{ width: CELL, height: CELL }}>
              <Photo id={id} />
            </div>
          ))}
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 110, backgroundColor: "#000", zIndex: 30 }} />
      <TabBar active="roll" revealed />
    </Screen>
  );
};
