/**
 * One color per person, the same on the map and in the Feed: derived from the member id over a
 * fixed palette of iOS system colors (with enough contrast for the white initial).
 */
export const MEMBER_COLORS = [
  "#FF3B30", // red
  "#FF9500", // orange
  "#34C759", // green
  "#00A39C", // mint
  "#30B0C7", // teal
  "#32ADE6", // cyan
  "#007AFF", // blue
  "#5856D6", // indigo
  "#AF52DE", // purple
  "#FF2D55", // pink
  "#A2845E", // brown
] as const;

export function memberColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return MEMBER_COLORS[hash % MEMBER_COLORS.length]!;
}
