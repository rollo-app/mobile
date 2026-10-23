import { useMemo } from "react";
import { albumTitle, createSaver } from "./save";

/** A saver bound to the roll's album, once the token and the roll's name are known. */
export function useSaver(token: string | null, tripName: string | undefined, timeZone?: string) {
  return useMemo(
    () => (token && tripName ? createSaver({ token, albumName: albumTitle(tripName), timeZone }) : null),
    [token, tripName, timeZone],
  );
}
