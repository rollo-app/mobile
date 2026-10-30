import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { linearTiming, TransitionSeries, type TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { PhotosProvider } from "./data/photos-context";
import type { PhotoRecord } from "./data/load-photos";
import { CameraScene } from "./scenes/CameraScene";
import { GalleryScene } from "./scenes/GalleryScene";
import { MapScene } from "./scenes/MapScene";
import { MomentScene } from "./scenes/MomentScene";
import { ProfileScene } from "./scenes/ProfileScene";
import { RevealScene } from "./scenes/RevealScene";
import { SCENES, SEAM_FRAMES, TRANSITION_FRAMES, totalFrames, type SceneId } from "./timeline";

const SCENE_COMPONENTS: Record<SceneId, () => React.JSX.Element> = {
  camera: CameraScene,
  map: MapScene,
  reveal: RevealScene,
  gallery: GalleryScene,
  profile: ProfileScene,
  moment: MomentScene,
};

/** The outgoing scene fades to black in the first half, the incoming one fades in from black in the second. */
const DipToBlack: React.FC<{ children: React.ReactNode; presentationProgress: number; presentationDirection: "entering" | "exiting" }> = ({
  children,
  presentationProgress,
  presentationDirection,
}) => {
  const opacity =
    presentationDirection === "exiting"
      ? interpolate(presentationProgress, [0, 0.5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : interpolate(presentationProgress, [0.5, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};
const dipToBlack = (): TransitionPresentation<Record<string, never>> => ({ component: DipToBlack as never, props: {} });

const PEAK = 0.92;
/** White shutter flash symmetric around the loop wrap: ramps up over the last frames, down over the first. */
const SeamFlash = () => {
  const frame = useCurrentFrame();
  const total = totalFrames();
  const half = SEAM_FRAMES / 2;
  const d = frame >= total - half ? frame - (total - half) + 1 : half - frame;
  const opacity = interpolate(d, [0, half], [0, PEAK], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (opacity <= 0) return null;
  return <AbsoluteFill style={{ backgroundColor: "#fff", opacity }} />;
};

export const Hero = ({ photos }: { photos: PhotoRecord[] }) => (
  <PhotosProvider photos={photos}>
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <TransitionSeries>
        {SCENES.flatMap((scene, i) => {
          const Scene = SCENE_COMPONENTS[scene.id];
          const items = [
            <TransitionSeries.Sequence key={scene.id} durationInFrames={scene.frames}>
              <Scene />
            </TransitionSeries.Sequence>,
          ];
          if (i < SCENES.length - 1) {
            const dip = scene.id === "map";
            items.push(
              <TransitionSeries.Transition
                key={`${scene.id}-t`}
                presentation={(dip ? dipToBlack() : fade()) as never}
                timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
              />,
            );
          }
          return items;
        })}
      </TransitionSeries>
      <SeamFlash />
    </AbsoluteFill>
  </PhotosProvider>
);
