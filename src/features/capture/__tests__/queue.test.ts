import { createQueue, type QueuedMedia } from "../queue";
import { memoryDb } from "@/test/sqlite-memory";

const TRIP = "11111111-1111-4111-8111-111111111111";

const item = (overrides: Partial<QueuedMedia> = {}): QueuedMedia => ({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  tripId: TRIP,
  type: "photo",
  takenAt: Date.parse("2027-01-12T17:32:00Z"),
  day: "2027-01-12",
  lat: -49.33,
  lng: -72.89,
  accuracyM: 12,
  caption: "el viento no perdona",
  durationS: null,
  width: 4000,
  height: 3000,
  sizeBytes: 2_500_000,
  originalUri: "file:///docs/pending/a/original.jpg",
  thumbUri: "file:///docs/pending/a/thumb.jpg",
  thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
  ...overrides,
});

describe("upload queue", () => {
  it("saves what is shot and returns it as pending, with all its data", async () => {
    const queue = await createQueue(memoryDb());

    await queue.enqueue(item());

    expect(await queue.pending()).toEqual([{ ...item(), attempts: 0, retryAt: null }]);
  });

  it("returns pending items in the order they were shot", async () => {
    const queue = await createQueue(memoryDb());

    await queue.enqueue(item({ id: "b", takenAt: 2000 }));
    await queue.enqueue(item({ id: "a", takenAt: 1000 }));

    expect((await queue.pending()).map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("saving the same id twice does not duplicate it", async () => {
    const queue = await createQueue(memoryDb());

    await queue.enqueue(item());
    await queue.enqueue(item());

    expect(await queue.pending()).toHaveLength(1);
  });

  it("accepts empty optional data (no GPS, no caption)", async () => {
    const queue = await createQueue(memoryDb());

    await queue.enqueue(item({ lat: null, lng: null, accuracyM: null, caption: null, thumbhash: null }));

    expect((await queue.pending())[0]).toMatchObject({ lat: null, caption: null, thumbhash: null });
  });

  it("counts what is not yet uploaded for a trip, by type and day", async () => {
    const queue = await createQueue(memoryDb());

    await queue.enqueue(item({ id: "1" }));
    await queue.enqueue(item({ id: "2" }));
    await queue.enqueue(item({ id: "3", type: "video" }));
    await queue.enqueue(item({ id: "4", day: "2027-01-11" }));
    await queue.enqueue(item({ id: "5", tripId: "otro" }));

    expect(await queue.countPending(TRIP, "2027-01-12")).toEqual({ photos: 2, videos: 1 });
  });

  it("reopening the queue on the same database loses nothing", async () => {
    const db = memoryDb();
    await (await createQueue(db)).enqueue(item());

    expect(await (await createQueue(db)).pending()).toHaveLength(1);
  });

  it("remove takes the item out of the queue", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item({ id: "a" }));
    await queue.enqueue(item({ id: "b" }));

    await queue.remove("a");

    expect((await queue.pending()).map((m) => m.id)).toEqual(["b"]);
  });

  it("markAttempt adds an attempt and stores when to retry", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item());

    await queue.markAttempt(item().id, 5000);
    await queue.markAttempt(item().id, 9000);

    expect((await queue.pending())[0]).toMatchObject({ attempts: 2, retryAt: 9000 });
  });

  it("markFailed removes it from pending and from the quota count, but does not delete it", async () => {
    const db = memoryDb();
    const queue = await createQueue(db);
    await queue.enqueue(item({ id: "a" }));
    await queue.enqueue(item({ id: "b" }));

    await queue.markFailed("a", "quota");

    expect((await queue.pending()).map((m) => m.id)).toEqual(["b"]);
    expect(await queue.countPending(TRIP, "2027-01-12")).toEqual({ photos: 1, videos: 0 });
    expect(await queue.failed()).toEqual([expect.objectContaining({ id: "a", failedReason: "quota" })]);
  });

  it("a markFailed survives reopening the queue", async () => {
    const db = memoryDb();
    const queue = await createQueue(db);
    await queue.enqueue(item());
    await queue.markFailed(item().id, "revealed");

    expect(await (await createQueue(db)).pending()).toEqual([]);
  });

  it("migrates an old database without the new columns", async () => {
    const db = memoryDb();
    await db.execAsync(`CREATE TABLE pending_media (
      id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL, type TEXT NOT NULL, taken_at INTEGER NOT NULL,
      day TEXT NOT NULL, lat REAL, lng REAL, accuracy_m REAL, caption TEXT, duration_s REAL, width INTEGER,
      height INTEGER, size_bytes INTEGER NOT NULL, original_uri TEXT NOT NULL, thumb_uri TEXT NOT NULL,
      thumbhash TEXT, attempts INTEGER NOT NULL DEFAULT 0);`);
    await db.runAsync(
      "INSERT INTO pending_media (id, trip_id, type, taken_at, day, size_bytes, original_uri, thumb_uri) VALUES ('old', 't', 'photo', 1, '2027-01-12', 1, 'o', 't')",
    );

    const queue = await createQueue(db);

    expect((await queue.pending())[0]).toMatchObject({ id: "old", attempts: 0, retryAt: null });
  });
});

describe("countPendingForTrip", () => {
  it("counts the trip's pending items from any day, excluding failed ones and other trips'", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item({ id: "a", day: "2027-01-12" }));
    await queue.enqueue(item({ id: "b", day: "2027-01-13", type: "video" }));
    await queue.enqueue(item({ id: "c", day: "2027-01-13" }));
    await queue.enqueue(item({ id: "d", tripId: "otro" }));
    await queue.markFailed("c", "quota");

    expect(await queue.countPendingForTrip(TRIP)).toBe(2);
    expect(await queue.countPendingForTrip("vacio")).toBe(0);
  });

  it("pendingForTrip returns that trip's pending items (with or without a location), excluding failed ones", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" }));
    await queue.enqueue(item({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", lat: null, lng: null }));
    await queue.enqueue(item({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3", tripId: "otro" }));
    await queue.enqueue(item({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4" }));
    await queue.markFailed("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4", "cupo");

    const found = await queue.pendingForTrip(TRIP);

    expect(found.map((m) => m.id)).toEqual([
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    ]);
  });
});

describe("failedForTrip and discard", () => {
  it("failedForTrip returns only that trip's failed items, with their reason, in shooting order", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item({ id: "a", takenAt: 2000 }));
    await queue.enqueue(item({ id: "b", takenAt: 1000 }));
    await queue.enqueue(item({ id: "c", takenAt: 3000 }));
    await queue.enqueue(item({ id: "d", tripId: "otro" }));
    await queue.markFailed("a", "Este rollo ya terminó");
    await queue.markFailed("b", "missing_file");
    await queue.markFailed("d", "deleted");

    const failed = await queue.failedForTrip(TRIP);

    expect(failed.map((m) => [m.id, m.failedReason])).toEqual([
      ["b", "missing_file"],
      ["a", "Este rollo ya terminó"],
    ]);
  });

  it("discard deletes a failed item and leaves the rest", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item({ id: "a" }));
    await queue.enqueue(item({ id: "b" }));
    await queue.markFailed("a", "deleted");

    await queue.discard("a");

    expect(await queue.failed()).toEqual([]);
    expect((await queue.pending()).map((m) => m.id)).toEqual(["b"]);
  });

  it("discard never deletes a pending item", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item({ id: "a" }));

    await queue.discard("a");

    expect((await queue.pending()).map((m) => m.id)).toEqual(["a"]);
  });
});
