import { loadPhotos, type PhotoRecord } from "./data/load-photos.ts";

export type Person = { id: string; name: string; initial: string; color: string };

// Same people and colors as scripts/site/mockups.mjs.
export const PEOPLE: Person[] = [
  { id: "cami", name: "Cami", initial: "C", color: "#FF2D55" },
  { id: "lu", name: "Lu", initial: "L", color: "#5856D6" },
  { id: "juani", name: "Juani", initial: "J", color: "#007AFF" },
  { id: "tomi", name: "Tomi", initial: "T", color: "#00A39C" },
  { id: "fede", name: "Fede", initial: "F", color: "#A2845E" },
  { id: "juan", name: "Juan", initial: "J", color: "#FF9500" },
];

const JUANI = PEOPLE.find((p) => p.id === "juani")!;
const OTHERS = PEOPLE.filter((p) => p.id !== "juani");

function safeLoad(): PhotoRecord[] {
  try {
    return loadPhotos();
  } catch {
    return [];
  }
}

/**
 * Juani took every front-camera photo; the rest rotate through the others by capture order.
 * Deterministic: the same photo always gets the same person.
 */
export function authorOf(photo: PhotoRecord, all: PhotoRecord[] = safeLoad()): Person {
  if (photo.camera === "front") return JUANI;
  const backs = all
    .filter((p) => p.camera === "back")
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const index = backs.findIndex((p) => p.id === photo.id);
  if (index >= 0) return OTHERS[index % OTHERS.length]!;
  let hash = 0;
  for (const ch of photo.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return OTHERS[hash % OTHERS.length]!;
}
