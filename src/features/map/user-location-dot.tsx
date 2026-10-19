import { Layer } from "@maplibre/maplibre-react-native";

/**
 * El punto azul del usuario, en cobalto. MapLibre no acepta colores dinámicos, así que el color
 * llega en hex según el esquema claro/oscuro. Se dibuja sobre la fuente que arma `UserLocation`.
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
