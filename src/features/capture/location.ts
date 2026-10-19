import * as Location from "expo-location";

export type Fix = { lat: number; lng: number; accuracyM: number | null };

const FRESH_TIMEOUT_MS = 8000;
const LAST_KNOWN_MAX_AGE_MS = 30 * 60 * 1000;

/**
 * Location for the photo. Requested as soon as the camera opens, so there is a fix by
 * the time it is sent. If it does not arrive in time (mountains, no signal), uses the last
 * known one with its accuracy. Without permission, no location: the photo is still saved.
 */
export async function startFix(): Promise<Fix | null> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return null;

    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), FRESH_TIMEOUT_MS)),
    ]);
    const position = fresh ?? (await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }));
    if (!position) return null;

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracyM: position.coords.accuracy ?? null,
    };
  } catch {
    return null;
  }
}
