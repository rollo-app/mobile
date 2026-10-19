import { LogManager } from "@maplibre/maplibre-react-native";

type MapLog = { level: string; tag: string; message: string };

/**
 * Sin señal MapLibre loguea un error por cada tile que no puede bajar: eso es esperable (el mapa
 * muestra lo que ya miraste) y llenaría LogBox. Solo estos; el resto se sigue logueando.
 */
export function isTileNetworkNoise({ tag, message }: MapLog): boolean {
  return tag === "Mbgl-HttpRequest" || /failed to load tile/i.test(message);
}

let installed = false;

export function silenceTileNetworkErrors() {
  if (installed) return;
  installed = true;
  // El handler devuelve true cuando ya manejó el log (lo descarta); false sigue con el log normal.
  LogManager.onLog((log) => isTileNetworkNoise(log));
}
