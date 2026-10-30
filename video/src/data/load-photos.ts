import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { PhotoRecord } from "../../scripts/photo-record.ts";

export type { PhotoRecord };

const DEFAULT_PATH = fileURLToPath(new URL("./photos.json", import.meta.url));
const MISSING =
  "Faltan las fotos: corré `npm run photos -- <zip o carpeta>` en video/";

export function loadPhotos(path: string = DEFAULT_PATH): PhotoRecord[] {
  if (!existsSync(path)) throw new Error(MISSING);
  return JSON.parse(readFileSync(path, "utf8")) as PhotoRecord[];
}

export function photoById(id: string, photos: PhotoRecord[] = loadPhotos()): PhotoRecord {
  const found = photos.find((p) => p.id === id);
  if (!found) throw new Error(`Foto desconocida: ${id}`);
  return found;
}
