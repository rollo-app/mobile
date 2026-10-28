import * as Location from "expo-location";
import { useCallback, useEffect, useState, type RefObject } from "react";
import type { CameraRef } from "@maplibre/maplibre-react-native";
import { USER_ZOOM } from "@/features/map/framing";

/** [lng, lat] of the last known position (or the current one if `orCurrent`); null if there is none. */
export async function knownPosition(orCurrent: boolean): Promise<[number, number] | null> {
  try {
    const position =
      (await Location.getLastKnownPositionAsync()) ??
      (orCurrent ? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }) : null);
    return position ? [position.coords.longitude, position.coords.latitude] : null;
  } catch {
    return null;
  }
}

/**
 * The user's location permission (`hasLocation`: null until known) and `centerOnUser`, which flies the
 * camera to where they are (asking for permission first if `ask`).
 */
export function useUserLocation(cameraRef: RefObject<CameraRef | null>) {
  const [hasLocation, setHasLocation] = useState<boolean | null>(null);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then((p) => setHasLocation(p.granted), () => setHasLocation(false));
  }, []);

  const centerOnUser = useCallback(
    async (ask: boolean): Promise<boolean> => {
      try {
        const permission = ask
          ? await Location.requestForegroundPermissionsAsync()
          : await Location.getForegroundPermissionsAsync();
        setHasLocation(permission.granted);
        if (!permission.granted) return false;
        const position =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (!position) return false;
        cameraRef.current?.flyTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: USER_ZOOM,
          duration: ask ? 600 : 0,
        });
        return true;
      } catch {
        return false; // With no location the map stays where it is.
      }
    },
    [cameraRef],
  );

  return { hasLocation, centerOnUser };
}
