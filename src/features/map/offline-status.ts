import { toMB } from "./offline";

export type OfflineMapState = {
  zones: number;
  bytes: number;
  /** Packs not fully downloaded yet. */
  incomplete: number;
  running: boolean;
  percent: number | null;
  /** There is something to download but the connection is not Wi-Fi yet. */
  waitingForWifi: boolean;
};

const NB_HYPHEN = "‑";

/** The line shown in "Perfil". */
export function describeOfflineMap(s: OfflineMapState): string {
  if (s.running) return s.percent === null ? "Bajando…" : `Bajando… ${Math.round(s.percent)} %`;
  if (s.zones > 0 && s.incomplete === 0) {
    return `Listo · ${s.zones} ${s.zones === 1 ? "zona" : "zonas"} · ${Math.max(1, Math.round(toMB(s.bytes)))} MB`;
  }
  if (s.waitingForWifi) return `Se baja con Wi${NB_HYPHEN}Fi`;
  if (s.incomplete > 0) return "Se completa cuando haya conexión";
  return "No hace falta todavía";
}
