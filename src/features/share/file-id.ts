/**
 * Short stable id for a cache key (FNV-1a, 32 bits, 8 hex chars), used to keep share file names under iOS's 255-byte limit.
 * Collisions are negligible at this app's scale (a handful of entries per screen visit).
 */
export function fileId(key: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
