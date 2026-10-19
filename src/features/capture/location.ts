import * as Location from "expo-location";

export type Fix = { lat: number; lng: number; accuracyM: number | null };

const FRESH_TIMEOUT_MS = 8000;
const LAST_KNOWN_MAX_AGE_MS = 30 * 60 * 1000;

/**
 * Ubicación para la foto. Se pide apenas se abre la cámara, así hay fix para
 * cuando se manda. Si no llega a tiempo (montaña, sin señal), usa la última
 * conocida con su precisión. Sin permiso, sin ubicación: la foto igual se guarda.
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
