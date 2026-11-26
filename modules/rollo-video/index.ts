import { requireOptionalNativeModule } from "expo";

export type VideoOptions = { uri: string; width: number; height: number; fps: number; bitrate: number };
export type VideoFile = { uri: string; bytes: number; frames: number };
export type InstagramTarget = "stories" | "reels";

type NativeRolloVideo = {
  open(options: VideoOptions): void;
  append(pixels: Uint8Array, bytesPerRow: number): void;
  appendTexture(pointer: string): void;
  finish(): Promise<VideoFile>;
  cancel(): void;
  shareToInstagram(options: { target: InstagramTarget; videoUri: string; appId: string }): Promise<boolean>;
};

const native = requireOptionalNativeModule<NativeRolloVideo>("RolloVideo");

/** False in a build without the native module (an older build that got this JS). */
export const videoAvailable = native != null;

const MISSING = "RolloVideo is not in this build";

function need(): NativeRolloVideo {
  if (!native) throw new Error(MISSING);
  return native;
}

export function openVideo(options: VideoOptions): void {
  need().open(options);
}

/** One frame as BGRA premultiplied bytes, top row first. */
export function appendFrame(pixels: Uint8Array, bytesPerRow: number): void {
  need().append(pixels, bytesPerRow);
}

/**
 * One frame from a Metal texture, given as its address (it does not fit a JS number safely).
 * The caller keeps the texture's surface alive for the duration of the call.
 */
export function appendTexture(pointer: bigint): void {
  need().appendTexture(pointer.toString());
}

export async function finishVideo(): Promise<VideoFile> {
  return need().finish();
}

export function cancelVideo(): void {
  native?.cancel();
}

/** Opens Instagram with the video as the background. False when Instagram can't be opened. */
export async function shareVideoToInstagram(target: InstagramTarget, videoUri: string, appId: string): Promise<boolean> {
  if (!native) return false;
  return native.shareToInstagram({ target, videoUri, appId });
}
