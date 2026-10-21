import { Directory, File, Paths } from "expo-file-system";
import { renderTabAvatar, type RingOptions } from "@/features/profile/tab-avatar";
import { downloadAsRgba, hexToRgb, writePng } from "@/features/profile/tab-avatar-files";

/** Pin photo diameter in pt; the PNG is 3x, shown at that size via `icon-size`. */
export const PIN_AVATAR_POINTS = 30;
export const PIN_AVATAR_SCALE = 3;
const SIZE = PIN_AVATAR_POINTS * PIN_AVATAR_SCALE;
/** White ring like the circle pins' stroke (2 pt). */
const RING: RingOptions = { color: hexToRgb("#FFFFFF"), width: 2 * PIN_AVATAR_SCALE, gap: 0 };

/** Makes (or reuses from the cache) the circular PNG of a pin and returns its file uri. */
export async function ensurePinAvatarFile(avatarUri: string, key: string): Promise<string> {
  const dir = new Directory(Paths.cache, "pin-avatar");
  dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, `v1-${key}.png`);
  if (file.exists) return file.uri;
  const { rgba, size } = await downloadAsRgba(avatarUri, new File(dir, `v1-${key}-source`), SIZE);
  writePng(file, renderTabAvatar(rgba, size, { ring: RING }), size);
  return file.uri;
}
