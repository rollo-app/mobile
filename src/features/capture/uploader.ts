import { ApiError, createApiClient, unwrap } from "@/api/client";
import type { PendingMedia, Queue } from "./queue";

/**
 * Sube la cola al server: registrar → PUT original y thumb → confirmar → limpiar.
 * Es seguro repetirlo en cualquier punto porque el id lo generó el celular y el
 * server es idempotente por id.
 */

export type UploaderDeps = {
  queue: Pick<Queue, "pending" | "remove" | "markAttempt" | "markFailed">;
  apiUrl: string;
  getToken: (tripId: string) => Promise<string | null>;
  /** PUT del archivo a la URL firmada; devuelve el status. Rechaza si no hay red. */
  putFile: (uri: string, url: string, contentType: string) => Promise<number>;
  /** Si el archivo local existe todavía. */
  fileExists: (uri: string) => Promise<boolean>;
  /** Borra la carpeta Documents/pending/<id>. */
  removeFiles: (id: string) => Promise<void>;
  now?: () => number;
};

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 5 * 60 * 1000;

/** Espera tras el intento n (1, 2, 4… segundos) hasta un tope de 5 minutos. */
export function retryDelay(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** (attempts - 1), BACKOFF_MAX_MS);
}

/** Falla del PUT a R2 (status 0 = no hubo red). */
class PutFailed extends Error {
  constructor(public readonly status: number) {
    super(`PUT ${status}`);
  }
}

type Phase = "register" | "complete";
type Verdict = { kind: "offline" } | { kind: "retry" } | { kind: "failed"; reason: string };

/** Qué hacer con un error: reintentar más tarde, cortar (sin red) o dar el ítem por perdido. */
function classify(error: unknown, phase: Phase): Verdict | null {
  if (error instanceof PutFailed) return error.status === 0 ? { kind: "offline" } : { kind: "retry" };
  if (!(error instanceof ApiError)) return null;
  const { status } = error;
  if (status === 0) return { kind: "offline" };
  if (status >= 500) return { kind: "retry" };
  if (status === 429) return { kind: "failed", reason: "quota" };
  if (status === 409) return { kind: "failed", reason: "revealed" };
  // Al confirmar, un 4xx puede ser un archivo que no terminó de llegar: se reintenta.
  if (phase === "complete") return { kind: "retry" };
  return { kind: "failed", reason: `http_${status}` };
}

export function createUploader(deps: UploaderDeps) {
  const now = deps.now ?? Date.now;
  let running: Promise<void> | null = null;
  let again = false;

  async function putAll(m: PendingMedia, urls: { original: string; thumb: string }) {
    const files = [
      { uri: m.originalUri, url: urls.original, contentType: m.type === "video" ? "video/mp4" : "image/jpeg" },
      { uri: m.thumbUri, url: urls.thumb, contentType: "image/jpeg" },
    ];
    for (const f of files) {
      let status: number;
      try {
        status = await deps.putFile(f.uri, f.url, f.contentType);
      } catch {
        throw new PutFailed(0);
      }
      if (status < 200 || status >= 300) throw new PutFailed(status);
    }
  }

  /** Sube un ítem de punta a punta. Tira si algo falla. */
  async function send(m: PendingMedia, token: string) {
    const api = createApiClient({ baseUrl: deps.apiUrl, token });
    const register = () =>
      unwrap(
        api.POST("/trips/{tripId}/media", {
          params: { path: { tripId: m.tripId } },
          body: {
            id: m.id,
            type: m.type,
            takenAt: m.takenAt,
            lat: m.lat,
            lng: m.lng,
            accuracyM: m.accuracyM,
            caption: m.caption,
            durationS: m.durationS,
            width: m.width,
            height: m.height,
            sizeBytes: m.sizeBytes,
            thumbhash: m.thumbhash,
          },
        }),
      );

    let registered = await register();
    if ("upload" in registered) {
      try {
        await putAll(m, registered.upload);
      } catch (e) {
        // URL vencida: el server da URLs nuevas para el mismo id.
        if (!(e instanceof PutFailed && e.status === 403)) throw e;
        registered = await register();
        if ("upload" in registered) await putAll(m, registered.upload);
      }
      if ("upload" in registered) {
        try {
          await unwrap(api.POST("/media/{mediaId}/complete", { params: { path: { mediaId: m.id } } }));
        } catch (e) {
          throw e instanceof ApiError ? new CompleteFailed(e) : e;
        }
      }
    }
  }

  async function pass() {
    const due = (await deps.queue.pending()).filter((m) => m.retryAt === null || m.retryAt <= now());
    for (const m of due) {
      try {
        const token = await deps.getToken(m.tripId);
        if (!token) {
          await deps.queue.markFailed(m.id, "no_token");
          continue;
        }
        if (!(await deps.fileExists(m.originalUri)) || !(await deps.fileExists(m.thumbUri))) {
          await deps.queue.markFailed(m.id, "missing_file");
          continue;
        }
        await send(m, token);
      } catch (e) {
        const phase: Phase = e instanceof CompleteFailed ? "complete" : "register";
        // Un error que no sabemos clasificar se reintenta: nunca corta la pasada ni traba la cola.
        const verdict = classify(e instanceof CompleteFailed ? e.cause : e, phase) ?? { kind: "retry" };
        if (verdict.kind === "failed") {
          await deps.queue.markFailed(m.id, verdict.reason);
          continue;
        }
        if (!(e instanceof PutFailed || e instanceof ApiError || e instanceof CompleteFailed)) {
          console.warn("Error inesperado al subir", m.id, e);
        }
        await deps.queue.markAttempt(m.id, now() + retryDelay(m.attempts + 1));
        if (verdict.kind === "offline") return;
        continue;
      }
      await deps.queue.remove(m.id);
      await deps.removeFiles(m.id);
    }
  }

  async function loop() {
    do {
      again = false;
      await pass();
    } while (again);
  }

  return {
    /**
     * Sube lo pendiente. Corre uno a la vez: si ya hay una corrida, pide otra pasada
     * al terminar (por si se encoló algo en el medio) y espera a la actual.
     */
    run(): Promise<void> {
      if (running) {
        again = true;
        return running;
      }
      running = loop().finally(() => {
        running = null;
      });
      return running;
    },
  };
}

/** Error de la confirmación: se trata distinto a los del registro (ver `classify`). */
class CompleteFailed extends Error {
  constructor(public readonly cause: ApiError) {
    super(cause.message);
  }
}
