import { Skia, type SkImage } from "@shopify/react-native-skia";
import { API_URL } from "@/config";
import { getSession } from "@/features/auth/session";

/** Downloads in flight at once. */
const CONCURRENCY = 4;
/** A request with no signal mid-way gives up instead of keeping the share sheet waiting. */
const TIMEOUT_MS = 15_000;

/** One image from `url`, decoded by Skia; null on any failure (status, network, timeout, undecodable bytes). */
export async function fetchImage(url: string, headers?: Record<string, string>): Promise<SkImage | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The media at each API path (the photos' `thumbPath`), with the session's Bearer, `CONCURRENCY` at a time.
 * Same order as `paths`; a download that fails is null in its place and never throws.
 */
export async function loadImages(paths: string[]): Promise<(SkImage | null)[]> {
  const token = await getSession();
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const images: (SkImage | null)[] = new Array(paths.length).fill(null);
  let next = 0;

  async function worker() {
    while (next < paths.length) {
      const index = next++;
      images[index] = await fetchImage(`${API_URL}${paths[index]}`, headers);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, paths.length) }, worker));
  return images;
}
