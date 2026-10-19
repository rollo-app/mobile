import { LogManager } from "@maplibre/maplibre-react-native";

type MapLog = { level: string; tag: string; message: string };

/**
 * Without signal MapLibre logs an error for each tile it can't download: that is expected (the map
 * shows what you already viewed) and would flood LogBox. Only these; everything else is still logged.
 */
export function isTileNetworkNoise({ tag, message }: MapLog): boolean {
  return tag === "Mbgl-HttpRequest" || /failed to load tile/i.test(message);
}

let installed = false;

export function silenceTileNetworkErrors() {
  if (installed) return;
  installed = true;
  // The handler returns true when it already handled the log (discards it); false continues with normal logging.
  LogManager.onLog((log) => isTileNetworkNoise(log));
}
