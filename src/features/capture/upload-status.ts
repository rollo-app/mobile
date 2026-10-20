import type { FailedMedia, PendingMedia } from "./queue";

export type MediaCounts = { photos: number; videos: number };

export type UploadSummary = {
  counts: MediaCounts;
  /** Earliest scheduled retry (ms) among the pending items, or null. */
  nextRetryAt: number | null;
  hasAnything: boolean;
};

/** "3 fotos esperando señal", "2 fotos y 1 video esperando señal". */
export function pendingText({ photos, videos }: MediaCounts) {
  const parts: string[] = [];
  if (photos > 0) parts.push(`${photos} ${photos === 1 ? "foto" : "fotos"}`);
  if (videos > 0) parts.push(`${videos} ${videos === 1 ? "video" : "videos"}`);
  return `${parts.join(" y ")} esperando señal`;
}

const FAILURE_TEXTS: Record<string, string> = {
  missing_file: "El archivo ya no está en el celular",
  deleted: "El admin la borró",
  no_token: "Ya no estás en este rollo",
};

/** Internal codes become plain language; the server's messages are already readable. */
export function failureText(reason: string) {
  return FAILURE_TEXTS[reason] ?? reason;
}

/** "Próximo intento en 2 min", or null when there is no retry ahead. */
export function nextAttemptText(retryAt: number | null, now: number) {
  if (retryAt === null || retryAt <= now) return null;
  const ms = retryAt - now;
  if (ms < 60_000) return "Próximo intento en menos de 1 min";
  if (ms >= 3_600_000) return `Próximo intento en ${Math.round(ms / 3_600_000)} h`;
  return `Próximo intento en ${Math.ceil(ms / 60_000)} min`;
}

export function summarize(pending: PendingMedia[], failed: FailedMedia[]): UploadSummary {
  const counts = {
    photos: pending.filter((m) => m.type === "photo").length,
    videos: pending.filter((m) => m.type === "video").length,
  };
  const retries = pending.flatMap((m) => (m.retryAt === null ? [] : [m.retryAt]));
  return {
    counts,
    nextRetryAt: retries.length ? Math.min(...retries) : null,
    hasAnything: pending.length + failed.length > 0,
  };
}
