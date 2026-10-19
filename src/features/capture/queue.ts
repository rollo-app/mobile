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

export type PendingMedia = QueuedMedia & { attempts: number };

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
    attempts INTEGER NOT NULL DEFAULT 0
  );
`;

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
});

export async function createQueue(db: QueueDb) {
  await db.execAsync(SCHEMA);

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
      const rows = await db.getAllAsync<Row>("SELECT * FROM pending_media ORDER BY taken_at");
      return rows.map(fromRow);
    },

    /** Lo sacado y no subido de un viaje en un día: se descuenta del cupo que informó el server. */
    async countPending(tripId: string, day: string) {
      const rows = await db.getAllAsync<{ type: MediaType; n: number }>(
        "SELECT type, COUNT(*) AS n FROM pending_media WHERE trip_id = ? AND day = ? GROUP BY type",
        tripId,
        day,
      );
      const count = (type: MediaType) => rows.find((r) => r.type === type)?.n ?? 0;
      return { photos: count("photo"), videos: count("video") };
    },
  };
}

export type Queue = Awaited<ReturnType<typeof createQueue>>;
