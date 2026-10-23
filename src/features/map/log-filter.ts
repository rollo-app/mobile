import { LogManager } from "@maplibre/maplibre-react-native";

type MapLog = { level: string; tag: string; message: string };

/**
 * Without signal MapLibre logs an error for each tile it can't download: that is expected (the map
 * shows what you already viewed) and would flood LogBox. Only these; everything else is still logged.
 */
export function isTileNetworkNoise({ tag, message }: MapLog): boolean {
  return tag === "Mbgl-HttpRequest" || /failed to load tile/i.test(message) || isSourceLoadFailure(message) || isConnectivityFailure(message);
}

// iOS translates the error text to the app's language, so match the structure and the error code, never the words.
const CONNECTIVITY_CODES = new Set([-1009, -1001, -1003, -1004, -1005, -1020, -1018]);

function isConnectivityFailure(message: string): boolean {
  if (!/Requesting:\s*\S+\s+failed with error/.test(message)) return false;
  const code = /Domain=NSURLErrorDomain\s+Code=(-?\d+)/.exec(message);
  return !!code && CONNECTIVITY_CODES.has(Number(code[1]));
}

/** The style's vector source can't be fetched (no signal, no DNS). The text after the colon is localized. */
function isSourceLoadFailure(message: string): boolean {
  return /\[event\]:Style\s+\[code\]:-1\s+\[message\]:Failed to load source/.test(message);
}

let installed = false;

export function silenceTileNetworkErrors() {
  if (installed) return;
  installed = true;
  // The handler returns true when it already handled the log (discards it); false continues with normal logging.
  LogManager.onLog((log) => isTileNetworkNoise(log));
}
