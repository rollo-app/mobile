import type { PhotoRecord } from "../../scripts/photo-record.ts";
import { MISSING_PHOTOS } from "./messages.ts";

type FetchLike = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/** Browser-safe loader used by calculateMetadata; fails loudly instead of rendering blank. */
export async function fetchPhotos(url: string, fetchImpl: FetchLike = fetch): Promise<PhotoRecord[]> {
  let response;
  try {
    response = await fetchImpl(url);
  } catch {
    throw new Error(MISSING_PHOTOS);
  }
  if (!response.ok) throw new Error(MISSING_PHOTOS);
  return (await response.json()) as PhotoRecord[];
}
