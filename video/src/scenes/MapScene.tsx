import { useRef } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { authorOf } from "../cast.ts";
import { usePhotos } from "../data/photos-context.tsx";
import { formatHour } from "../format.ts";
import { lightBounds, useMap, type Camera } from "../map/use-map.ts";
import { mapPhotos } from "../selection.ts";
import { Avatar } from "../ui/Avatar.tsx";
import { Photo } from "../ui/Photo.tsx";
import { Screen } from "../ui/Screen.tsx";
import { Segmented } from "../ui/Segmented.tsx";
import { TabBar } from "../ui/TabBar.tsx";
import { colors, fonts, type } from "../ui/theme.ts";

const BUDAPEST: Camera = { lat: 47.5, lng: 19.05, zoom: 12.5 };
const MOVE = [60, 110] as const;
const CENTER = { x: 270, y: 585 };
const worldSize = (zoom: number) => 512 * 2 ** zoom;
/** Web Mercator pixel of a location at a zoom. */
const toWorld = (c: { lng: number; lat: number }, zoom: number) => {
  const size = worldSize(zoom);
  const sin = Math.sin((c.lat * Math.PI) / 180);
  return { x: ((c.lng + 180) / 360) * size, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size };
};
const fromWorld = (p: { x: number; y: number }, zoom: number) => {
  const size = worldSize(zoom);
  const n = Math.PI - (2 * Math.PI * p.y) / size;
  return { lng: (p.x / size) * 360 - 180, lat: (Math.atan(Math.sinh(n)) * 180) / Math.PI };
};
const ease = Easing.bezier(0.45, 0, 0.55, 1);
/** Within ~25 km of the city center. */
const inBudapest = (p: { lat: number | null; lng: number | null }) => Math.abs(p.lat! - BUDAPEST.lat) < 0.22 && Math.abs(p.lng! - BUDAPEST.lng) < 0.32;

/** Another pin sits close enough that this one's hour label would collide with it. */
const crowded = (points: { x: number; y: number }[], i: number) =>
  points.some((q, j) => j !== i && Math.hypot(q.x - points[i]!.x, q.y - points[i]!.y) < 90);

export const MapScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const all = usePhotos();
  const pins = mapPhotos(all);
  const container = useRef<HTMLDivElement>(null);

  const progressAt = (f: number) => interpolate(f, MOVE, [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const { points } = useMap({
    container,
    frame,
    bounds: lightBounds(pins.map((p) => ({ lng: p.lng!, lat: p.lat! }))),
    padding: { top: 200, bottom: 180, left: 70, right: 70 },
    cameraAt: (f, wide) => {
      const t = progressAt(f);
      const zoom = wide.zoom + (BUDAPEST.zoom - wide.zoom) * t;
      // Zoom around Budapest: its screen position eases from where it sits in the wide shot to the
      // viewport center, so the pins never drift off while the zoom changes.
      const b0 = toWorld(BUDAPEST, wide.zoom);
      const c0 = toWorld(wide, wide.zoom);
      const start = { x: CENTER.x + (b0.x - c0.x), y: CENTER.y + (b0.y - c0.y) };
      const screen = { x: start.x + (CENTER.x - start.x) * t, y: start.y + (CENTER.y - start.y) * t };
      const b = toWorld(BUDAPEST, zoom);
      return { ...fromWorld({ x: b.x - (screen.x - CENTER.x), y: b.y - (screen.y - CENTER.y) }, zoom), zoom };
    },
    locations: pins.map((p) => ({ lng: p.lng!, lat: p.lat! })),
  });

  const t = progressAt(frame);
  const step = Math.min(3, 54 / Math.max(1, pins.length));
  const size = 36 + (56 - 36) * t;
  const budapest = pins.filter(inBudapest);
  const latest = budapest[budapest.length - 1];
  const cardIn = spring({ frame: frame - 110, fps, config: { damping: 22, stiffness: 140 } });
  const showCard = frame >= 110 && latest;

  return (
    <Screen>
      <div ref={container} style={{ position: "absolute", inset: 0 }} />
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {pins.map((p, i) => {
          const pt = points[i];
          if (!pt) return null;
          const pop = spring({ frame: frame - i * step, fps, config: { damping: 12, stiffness: 180 } });
          if (frame < i * step) return null;
          if (pt.x < -80 || pt.x > 620 || pt.y < -80 || pt.y > 1250) return null;
          const selected = latest?.id === p.id && frame >= 110;
          const person = authorOf(p, all);
          return (
            <div
              key={p.id}
              style={{
                position: "absolute", left: pt.x - size / 2, top: pt.y - size / 2, width: size, height: size,
                transform: `scale(${0.5 + 0.5 * pop})`, opacity: Math.min(1, pop * 2), borderRadius: size, boxSizing: "border-box",
                border: "4px solid #fff", boxShadow: selected ? `0 0 0 8px ${colors.tint}, 0 4px 10px rgba(0,0,0,0.5)` : "0 4px 10px rgba(0,0,0,0.5)",
                zIndex: selected ? 5 : 1,
              }}
            >
              <div style={{ position: "absolute", inset: 0, borderRadius: size, overflow: "hidden" }}>
                <Avatar person={person} size={size - 8} />
              </div>
              {t > 0.85 && (selected || (!crowded(points, i) && pt.x > 60 && pt.x < 480)) && (
                <div
                  style={{
                    position: "absolute", top: size + 6, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap",
                    padding: "2px 12px", borderRadius: 20, backgroundColor: "rgba(28,28,30,0.9)", color: colors.label,
                    fontFamily: fonts.sans, fontSize: 22, lineHeight: "30px", fontWeight: 600, opacity: (t - 0.85) / 0.15,
                  }}
                >
                  {formatHour(p.takenAt)}
                </div>
              )}
            </div>
          );
        })}
      </AbsoluteFill>
      <div style={{ position: "absolute", top: 118, left: 120, right: 120, zIndex: 20 }}>
        <Segmented items={["Mapa", "Feed"]} active={0} />
      </div>
      <div
        style={{
          position: "absolute", left: 14, bottom: 162, fontFamily: fonts.sans, fontSize: 16, lineHeight: "20px",
          color: colors.secondaryLabel, zIndex: 20,
        }}
      >
        © OpenFreeMap © OpenStreetMap
      </div>
      {showCard && latest && (
        <div
          style={{
            position: "absolute", left: 28, right: 28, bottom: 190, borderRadius: 32, padding: 20,
            backgroundColor: colors.secondaryBackground, display: "flex", alignItems: "center", gap: 20, zIndex: 30,
            transform: `translateY(${(1 - cardIn) * 80}px)`, opacity: cardIn, boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
          }}
        >
          <Avatar person={authorOf(latest, all)} size={64} />
          <div style={{ flex: 1, fontFamily: fonts.sans }}>
            <div style={{ ...type.body, fontWeight: 600 }}>{authorOf(latest, all).name}</div>
            <div style={{ ...type.footnote, color: colors.secondaryLabel }}>sacó una foto · {formatHour(latest.takenAt)}</div>
          </div>
          <div style={{ width: 104, height: 104, borderRadius: 20, overflow: "hidden", position: "relative" }}>
            <Photo id={latest.id} blur={30} style={{ transform: "scale(1.3)" }} />
          </div>
        </div>
      )}
      <TabBar active="map" />
    </Screen>
  );
};
