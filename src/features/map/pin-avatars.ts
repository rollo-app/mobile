import { cacheKey } from "@/features/profile/tab-avatar";
import type { MapItem } from "./features";

export type AvatarSource = { authorId: string; avatarUrl: string; key: string };

/** Name of the author's photo as a map style image; a new photo has a new path, so a new key. */
export function pinAvatarKey(authorId: string, avatarUrl: string): string {
  return `avatar-${authorId}-${cacheKey(avatarUrl)}`;
}

/** One entry per author that has a profile photo (in order of first appearance). */
export function avatarSources(items: MapItem[]): AvatarSource[] {
  const seen = new Set<string>();
  const out: AvatarSource[] = [];
  for (const i of items) {
    if (!i.authorAvatarUrl || seen.has(i.authorId)) continue;
    seen.add(i.authorId);
    out.push({ authorId: i.authorId, avatarUrl: i.authorAvatarUrl, key: pinAvatarKey(i.authorId, i.authorAvatarUrl) });
  }
  return out;
}
