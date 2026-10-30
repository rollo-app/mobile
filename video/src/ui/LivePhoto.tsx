import { Freeze, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { usePhoto } from "../data/photos-context.tsx";
import { liveWindow } from "../../scripts/live-photo.ts";
import { Photo } from "./Photo.tsx";

/** Frames after the shutter during which the clip still plays (under the flash), before the still takes over. */
export const LIVE_TAIL = 2;

const videoStyle = { width: "100%", height: "100%", objectFit: "cover", display: "block" } as const;

/**
 * Live Photo viewfinder: the clip plays so its still moment lands on `shutterAt` (segment-local frame,
 * i.e. relative to the surrounding Sequence), then the real still replaces it under the flash.
 * Photos without a clip just show the still.
 */
export const LivePhoto = ({ id, mirror = false, shutterAt }: { id: string; mirror?: boolean; shutterAt: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const record = usePhoto(id);
  if (!record.live || frame >= shutterAt + LIVE_TAIL) return <Photo id={id} mirror={mirror} />;
  const { startFrom, hold } = liveWindow(record.live.stillAt, fps, shutterAt);
  const style = { ...videoStyle, transform: mirror ? "scaleX(-1)" : undefined };
  const src = staticFile(record.live.file);
  return frame < hold ? (
    <Freeze frame={0}>
      <OffthreadVideo src={src} muted startFrom={0} style={style} />
    </Freeze>
  ) : (
    <Sequence from={hold} layout="none">
      <OffthreadVideo src={src} muted startFrom={startFrom} style={style} />
    </Sequence>
  );
};
