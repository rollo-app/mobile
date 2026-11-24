const PREVIEW_CHARS = 30;
/** One-line preview of the description for the row: its first line, cut at ~30 characters. */
export function descriptionPreview(description: string | null | undefined): string | undefined {
  const first = description?.split("\n")[0]?.trim();
  if (!first) return undefined;
  return first.length > PREVIEW_CHARS ? `${first.slice(0, PREVIEW_CHARS).trimEnd()}…` : first;
}
