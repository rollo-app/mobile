import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { File, Paths } from "expo-file-system";
import { SHUTTER_SAMPLE_RATE, shutterSamples, wav } from "./shutter-wav";

/**
 * The reveal's shutter click, written once as a WAV in the cache. It doesn't set the audio mode:
 * expo-audio's default already follows the silent switch, and the app's audio session (the
 * stories' videos) stays as it was.
 */

let player: AudioPlayer | null = null;

/** Writes the WAV (once) and loads a player. Failures are silent: the sound is a nice-to-have. */
export async function prepareShutter(): Promise<void> {
  try {
    const file = new File(Paths.cache, "rollo-shutter.wav");
    if (!file.exists) {
      file.create({ overwrite: true });
      await file.write(wav(shutterSamples(), SHUTTER_SAMPLE_RATE));
    }
    player?.remove();
    player = createAudioPlayer(file.uri);
  } catch {
    player = null;
  }
}

export function playShutter() {
  try {
    void player?.seekTo(0);
    player?.play();
  } catch {
    // ignore
  }
}

export function releaseShutter() {
  player?.remove();
  player = null;
}
