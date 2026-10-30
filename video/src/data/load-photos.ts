import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { PhotoRecord } from "../../scripts/photo-record.ts";
import { MISSING_PHOTOS } from "./messages.ts";

// Node only (scripts and tests). Compositions get photos from PhotosProvider.
export type { PhotoRecord };

const DEFAULT_PATH = fileURLToPath(new URL("./photos.json", import.meta.url));

export function loadPhotos(path: string = DEFAULT_PATH): PhotoRecord[] {
  if (!existsSync(path)) throw new Error(MISSING_PHOTOS);
  return JSON.parse(readFileSync(path, "utf8")) as PhotoRecord[];
}

export { photoById } from "./photo-by-id.ts";
