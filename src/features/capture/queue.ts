/**
 * Local queue of what was captured and not yet uploaded. Lives in SQLite to
 * survive app restarts and days without signal. The id is the UUID generated
 * on the phone: retrying the upload with the same id is safe.
 */

export type MediaType = "photo" | "video";

export type QueuedMedia = {
  id: string;
  tripId: string;
  type: MediaType;
  takenAt: number;
  /** Trip-local date (YYYY-MM-DD), for the daily quota. */
  day: string;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  caption: string | null;
  durationS: number | null;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  /** Exact byte size of the thumb file; null/absent for items queued by older versions. */
  thumbSizeBytes?: number | null;
  originalUri: string;
  thumbUri: string;
  thumbhash: string | null;
};

export type PendingMedia = QueuedMedia & {
  attempts: number;
  /** Do not retry before this time (ms): the backoff between attempts. */
  retryAt: number | null;
};

/** What the server rejected for good: stays on the phone with its files. */
export type FailedMedia = PendingMedia & { failedReason: string };

/** What we use from expo-sqlite (in tests it is satisfied with node:sqlite). */
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

/** Columns added after the first version: added to already-created databases. */
const ADDED_COLUMNS = [
  ["retry_at", "INTEGER"],
  ["failed_reason", "TEXT"],
  ["thumb_size_bytes", "INTEGER"],
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
  thumb_size_bytes: number | null;
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
  thumbSizeBytes: r.thumb_size_bytes ?? null,
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
           size_bytes, original_uri, thumb_uri, thumbhash, thumb_size_bytes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        m.id, m.tripId, m.type, m.takenAt, m.day, m.lat, m.lng, m.accuracyM, m.caption, m.durationS,
        m.width, m.height, m.sizeBytes, m.originalUri, m.thumbUri, m.thumbhash, m.thumbSizeBytes ?? null,
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

    /** A trip's failed items, in shooting order (for the upload status). */
    async failedForTrip(tripId: string): Promise<FailedMedia[]> {
      const rows = await db.getAllAsync<Row>(
        "SELECT * FROM pending_media WHERE trip_id = ? AND failed_reason IS NOT NULL ORDER BY taken_at",
        tripId,
      );
      return rows.map((r) => ({ ...fromRow(r), failedReason: r.failed_reason as string }));
    },

    /** The user gives up on a failed item. Only failed rows: a pending one is never lost by mistake. */
    async discard(id: string) {
      await db.runAsync("DELETE FROM pending_media WHERE id = ? AND failed_reason IS NOT NULL", id);
    },

    async remove(id: string) {
      await db.runAsync("DELETE FROM pending_media WHERE id = ?", id);
    },

    /** A failed attempt: bumps the counter and defers the next one until `retryAt`. */
    async markAttempt(id: string, retryAt: number) {
      await db.runAsync("UPDATE pending_media SET attempts = attempts + 1, retry_at = ? WHERE id = ?", retryAt, id);
    },

    /** The server rejected it for good (quota, developed roll…): neither retried nor deleted. */
    async markFailed(id: string, reason: string) {
      await db.runAsync("UPDATE pending_media SET failed_reason = ? WHERE id = ?", reason, id);
    },

    /** Pending items of a trip that have a location (for the map), excluding failed ones. */
    async pendingForTrip(tripId: string): Promise<PendingMedia[]> {
      const rows = await db.getAllAsync<Row>(
        "SELECT * FROM pending_media WHERE trip_id = ? AND failed_reason IS NULL ORDER BY taken_at",
        tripId,
      );
      return rows.map(fromRow);
    },

    /** Everything captured and not uploaded for a trip, any day, excluding failed ones. */
    async countPendingForTrip(tripId: string) {
      const rows = await db.getAllAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM pending_media WHERE trip_id = ? AND failed_reason IS NULL",
        tripId,
      );
      return rows[0]?.n ?? 0;
    },

    /** Captured and not uploaded for a trip on a day: subtracted from the quota the server reported. */
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
