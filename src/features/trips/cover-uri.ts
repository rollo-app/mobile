import { API_URL } from "@/config";

/** A roll's cover as an image URI: a local file (just created) as is, a server path under the API; null without a cover. */
export function coverUri(coverUrl: string | null | undefined): string | null {
  if (!coverUrl) return null;
  return coverUrl.startsWith("file:") ? coverUrl : `${API_URL}${coverUrl}`;
}
