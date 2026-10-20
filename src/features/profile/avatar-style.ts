import { API_URL } from "@/config";
import { memberColor } from "@/features/map/member-color";

/** First letter of the name, uppercase; "?" if there's none. */
export function initialOf(name: string | null | undefined): string {
  return name?.trim().charAt(0).toUpperCase() || "?";
}

/** Same color for a person everywhere (feed, map, avatars): derived from their id. */
export const avatarColor = memberColor;

/** `avatarUrl` comes from the API as a public path (/avatars/…): it needs the base URL, no token. */
export function avatarUri(avatarUrl: string | null | undefined, baseUrl: string = API_URL): string | null {
  return avatarUrl ? `${baseUrl}${avatarUrl}` : null;
}
