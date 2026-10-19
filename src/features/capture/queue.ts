/**
 * Cola local de lo que se sacó y todavía no se subió. Vive en SQLite para
 * sobrevivir a cierres de la app y a días sin señal. El id es el UUID generado
 * en el celular: reintentar la subida con el mismo id es seguro.
 */

export type MediaType = "photo" | "video";

export type QueuedMedia = {
  id: string;
  tripId: string;
  type: MediaType;
  takenAt: number;
  /** Fecha local del viaje (YYYY-MM-DD), para el cupo diario. */
  day: string;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  caption: string | null;
  durationS: number | null;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  originalUri: string;
  thumbUri: string;
  thumbhash: string | null;
};

export type PendingMedia = QueuedMedia & {
  attempts: number;
  /** No reintentar antes de esta hora (ms): el backoff entre intentos. */
  retryAt: number | null;
};

/** Lo que el server rechazó para siempre: se queda en el celular con sus archivos. */
export type FailedMedia = PendingMedia & { failedReason: string };

/** Lo que usamos de expo-sqlite (en los tests se cumple con node:sqlite). */
export type QueueDb = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
};

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS pending_media (
    id TEXT PRIMARY KEY NOT NULL,
    trip_id TEXT NOT NULL,
    type TEXT NOT NULL,
    taken_at INTEGER NOT NULL,
    day TEXT NOT NULL,
    lat REAL,
    lng REAL,
    accuracy_m REAL,
    caption TEXT,
    duration_s REAL,
    width INTEGER,
    height INTEGER,
    size_bytes INTEGER NOT NULL,
    original_uri TEXT NOT NULL,
    thumb_uri TEXT NOT NULL,
    thumbhash TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    retry_at INTEGER,
    failed_reason TEXT
  );
`;

/** Columnas agregadas después de la primera versión: se suman a bases ya creadas. */
const ADDED_COLUMNS = [
  ["retry_at", "INTEGER"],
  ["failed_reason", "TEXT"],
] as const;

type Row = {
  id: string;
  trip_id: string;
  type: MediaType;
  taken_at: number;
  day: string;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  caption: string | null;
  duration_s: number | null;
  width: number | null;
  height: number | null;
  size_bytes: number;
  original_uri: string;
  thumb_uri: string;
  thumbhash: string | null;
  attempts: number;
  retry_at: number | null;
  failed_reason: string | null;
};

const fromRow = (r: Row): PendingMedia => ({
  id: r.id,
  tripId: r.trip_id,
  type: r.type,
  takenAt: r.taken_at,
  day: r.day,
  lat: r.lat,
  lng: r.lng,
  accuracyM: r.accuracy_m,
  caption: r.caption,
  durationS: r.duration_s,
  width: r.width,
  height: r.height,
  sizeBytes: r.size_bytes,
  originalUri: r.original_uri,
  thumbUri: r.thumb_uri,
  thumbhash: r.thumbhash,
  attempts: r.attempts,
  retryAt: r.retry_at,
});

export async function createQueue(db: QueueDb) {
  await db.execAsync(SCHEMA);
  const columns = (await db.getAllAsync<{ name: string }>("PRAGMA table_info(pending_media)")).map((c) => c.name);
  for (const [name, sqlType] of ADDED_COLUMNS) {
    if (!columns.includes(name)) await db.execAsync(`ALTER TABLE pending_media ADD COLUMN ${name} ${sqlType}`);
  }

  return {
    async enqueue(m: QueuedMedia) {
      await db.runAsync(
        `INSERT OR IGNORE INTO pending_media
          (id, trip_id, type, taken_at, day, lat, lng, accuracy_m, caption, duration_s, width, height,
           size_bytes, original_uri, thumb_uri, thumbhash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        m.id, m.tripId, m.type, m.takenAt, m.day, m.lat, m.lng, m.accuracyM, m.caption, m.durationS,
        m.width, m.height, m.sizeBytes, m.originalUri, m.thumbUri, m.thumbhash,
      );
    },

    async pending(): Promise<PendingMedia[]> {
      const rows = await db.getAllAsync<Row>("SELECT * FROM pending_media WHERE failed_reason IS NULL ORDER BY taken_at");
      return rows.map(fromRow);
    },

    async failed(): Promise<FailedMedia[]> {
      const rows = await db.getAllAsync<Row>(
        "SELECT * FROM pending_media WHERE failed_reason IS NOT NULL ORDER BY taken_at",
      );
      return rows.map((r) => ({ ...fromRow(r), failedReason: r.failed_reason as string }));
    },

    async remove(id: string) {
      await db.runAsync("DELETE FROM pending_media WHERE id = ?", id);
    },

    /** Un intento que no salió: suma al contador y difiere el próximo hasta `retryAt`. */
    async markAttempt(id: string, retryAt: number) {
      await db.runAsync("UPDATE pending_media SET attempts = attempts + 1, retry_at = ? WHERE id = ?", retryAt, id);
    },

    /** El server lo rechazó para siempre (cupo, rollo revelado…): no se reintenta ni se borra. */
    async markFailed(id: string, reason: string) {
      await db.runAsync("UPDATE pending_media SET failed_reason = ? WHERE id = ?", reason, id);
    },

    /** Lo sacado y no subido de un viaje en un día: se descuenta del cupo que informó el server. */
    async countPending(tripId: string, day: string) {
      const rows = await db.getAllAsync<{ type: MediaType; n: number }>(
        "SELECT type, COUNT(*) AS n FROM pending_media WHERE trip_id = ? AND day = ? AND failed_reason IS NULL GROUP BY type",
        tripId,
        day,
      );
      const count = (type: MediaType) => rows.find((r) => r.type === type)?.n ?? 0;
      return { photos: count("photo"), videos: count("video") };
    },
  };
}

export type Queue = Awaited<ReturnType<typeof createQueue>>;
