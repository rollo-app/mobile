/**
 * A short shutter "click-clack" synthesized in code: two decaying noise bursts with a low thump,
 * as 16-bit mono samples, and the WAV file around them.
 */

export const SHUTTER_SAMPLE_RATE = 22050;
const LENGTH_S = 0.14;

export function shutterSamples(): Int16Array {
  const count = Math.round(SHUTTER_SAMPLE_RATE * LENGTH_S);
  const out = new Int16Array(count);
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  const click = (t: number, at: number, gain: number) => {
    const dt = t - at;
    if (dt < 0) return 0;
    const noise = random() * Math.exp(-dt / 0.004);
    const thump = Math.sin(2 * Math.PI * 160 * dt) * Math.exp(-dt / 0.012) * 0.6;
    return (noise + thump) * gain;
  };
  for (let i = 0; i < count; i++) {
    const t = i / SHUTTER_SAMPLE_RATE;
    const v = click(t, 0, 0.9) + click(t, 0.055, 0.6);
    out[i] = Math.max(-1, Math.min(1, v)) * 32767;
  }
  return out;
}

/** A 16-bit mono PCM WAV file with the given samples. */
export function wav(samples: Int16Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => view.setInt16(44 + i * 2, s, true));
  return bytes;
}
