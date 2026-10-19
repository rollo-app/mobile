import { Layer } from "@maplibre/maplibre-react-native";

/**
 * The user's blue dot, in cobalt. MapLibre doesn't accept dynamic colors, so the color
 * comes in as hex per the light/dark scheme. Drawn over the source that `UserLocation` builds.
 */
export function UserLocationDot({ color }: { color: string }) {
  return (
    <>
      <Layer
        type="circle"
        id="user-location-halo"
        source="mlrn-user-location"
        paint={{ "circle-radius": 9, "circle-color": "#FFFFFF", "circle-pitch-alignment": "map" }}
      />
      <Layer
        type="circle"
        id="user-location-dot"
        source="mlrn-user-location"
        paint={{ "circle-radius": 6, "circle-color": color, "circle-pitch-alignment": "map" }}
      />
    </>
  );
}
