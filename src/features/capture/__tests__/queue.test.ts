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
  momentDay: null,
  pairedWith: null,
  ownerUserId: "u1",
  ...overrides,
});

describe("upload queue", () => {
  it("saves what is shot and returns it as pending, with all its data", async () => {
    const queue = await createQueue(memoryDb());

    await queue.enqueue(item());

    expect(await queue.pending("u1")).toEqual([{ ...item(), attempts: 0, retryAt: null }]);
  });

  it("returns pending items in the order they were shot", async () => {
    const queue = await createQueue(memoryDb());

    await queue.enqueue(item({ id: "b", takenAt: 2000 }));
    await queue.enqueue(item({ id: "a", takenAt: 1000 }));

    expect((await queue.pending("u1")).map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("saving the same id twice does not duplicate it", async () => {
    const queue = await createQueue(memoryDb());

    await queue.enqueue(item());
    await queue.enqueue(item());

    expect(await queue.pending("u1")).toHaveLength(1);
  });

  it("accepts empty optional data (no GPS, no caption)", async () => {
    const queue = await createQueue(memoryDb());

    await queue.enqueue(item({ lat: null, lng: null, accuracyM: null, caption: null, thumbhash: null }));

    expect((await queue.pending("u1"))[0]).toMatchObject({ lat: null, caption: null, thumbhash: null });
  });

  it("counts what is not yet uploaded for a trip, by type and day", async () => {
    const queue = await createQueue(memoryDb());

    await queue.enqueue(item({ id: "1" }));
    await queue.enqueue(item({ id: "2" }));
    await queue.enqueue(item({ id: "3", type: "video" }));
    await queue.enqueue(item({ id: "4", day: "2027-01-11" }));
    await queue.enqueue(item({ id: "5", tripId: "otro" }));

    expect(await queue.countPending("u1", TRIP, "2027-01-12")).toEqual({ photos: 2, videos: 1 });
  });

  it("without a day it counts the whole rollo's pending items, any day", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item({ id: "1", day: "2027-01-12" }));
    await queue.enqueue(item({ id: "2", day: "2027-01-13" }));
    await queue.enqueue(item({ id: "3", day: "2027-01-13", type: "video" }));
    await queue.enqueue(item({ id: "4", tripId: "otro" }));

    expect(await queue.countPending("u1", TRIP)).toEqual({ photos: 2, videos: 1 });
  });

  it("reopening the queue on the same database loses nothing", async () => {
    const db = memoryDb();
    await (await createQueue(db)).enqueue(item());

    expect(await (await createQueue(db)).pending("u1")).toHaveLength(1);
  });

  it("remove takes the item out of the queue", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item({ id: "a" }));
    await queue.enqueue(item({ id: "b" }));

    await queue.remove("a");

    expect((await queue.pending("u1")).map((m) => m.id)).toEqual(["b"]);
  });

  it("markAttempt adds an attempt and stores when to retry", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item());

    await queue.markAttempt(item().id, 5000);
    await queue.markAttempt(item().id, 9000);

    expect((await queue.pending("u1"))[0]).toMatchObject({ attempts: 2, retryAt: 9000 });
  });

  it("markFailed removes it from pending and from the quota count, but does not delete it", async () => {
    const db = memoryDb();
    const queue = await createQueue(db);
    await queue.enqueue(item({ id: "a" }));
    await queue.enqueue(item({ id: "b" }));

    await queue.markFailed("a", "quota");

    expect((await queue.pending("u1")).map((m) => m.id)).toEqual(["b"]);
    expect(await queue.countPending("u1", TRIP, "2027-01-12")).toEqual({ photos: 1, videos: 0 });
    expect(await queue.failed("u1")).toEqual([expect.objectContaining({ id: "a", failedReason: "quota" })]);
  });

  it("a markFailed survives reopening the queue", async () => {
    const db = memoryDb();
    const queue = await createQueue(db);
    await queue.enqueue(item());
    await queue.markFailed(item().id, "revealed");

    expect(await (await createQueue(db)).pending("u1")).toEqual([]);
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
    await queue.claimUnowned("u1");

    expect((await queue.pending("u1"))[0]).toMatchObject({ id: "old", attempts: 0, retryAt: null });
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

    expect(await queue.countPendingForTrip("u1", TRIP)).toBe(2);
    expect(await queue.countPendingForTrip("u1", "vacio")).toBe(0);
  });

  it("a moment's pending selfie is not counted nor listed: the moment counts once", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item({ id: "main", momentDay: "2027-01-12" }));
    await queue.enqueue(item({ id: "selfie", momentDay: "2027-01-12", pairedWith: "main" }));

    expect(await queue.countPendingForTrip("u1", TRIP)).toBe(1);
    expect((await queue.pendingForTrip("u1", TRIP)).map((m) => m.id)).toEqual(["main"]);
    expect((await queue.pending("u1")).map((m) => m.id).sort()).toEqual(["main", "selfie"]);
  });

  it("pendingForTrip returns that trip's pending items (with or without a location), excluding failed ones", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" }));
    await queue.enqueue(item({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", lat: null, lng: null }));
    await queue.enqueue(item({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3", tripId: "otro" }));
    await queue.enqueue(item({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4" }));
    await queue.markFailed("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4", "cupo");

    const found = await queue.pendingForTrip("u1", TRIP);

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

    const failed = await queue.failedForTrip("u1", TRIP);

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

    expect(await queue.failed("u1")).toEqual([]);
    expect((await queue.pending("u1")).map((m) => m.id)).toEqual(["b"]);
  });

  it("discard never deletes a pending item", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item({ id: "a" }));

    await queue.discard("a");

    expect((await queue.pending("u1")).map((m) => m.id)).toEqual(["a"]);
  });
});

describe("moment rows", () => {
  it("reads an old row (without the moment columns) with momentDay and pairedWith null", async () => {
    const db = memoryDb();
    await db.execAsync(
      `CREATE TABLE pending_media (id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL, type TEXT NOT NULL, taken_at INTEGER NOT NULL, day TEXT NOT NULL, lat REAL, lng REAL, accuracy_m REAL, caption TEXT, duration_s REAL, width INTEGER, height INTEGER, size_bytes INTEGER NOT NULL, original_uri TEXT NOT NULL, thumb_uri TEXT NOT NULL, thumbhash TEXT, attempts INTEGER NOT NULL DEFAULT 0)`,
    );
    await db.runAsync(
      "INSERT INTO pending_media (id, trip_id, type, taken_at, day, size_bytes, original_uri, thumb_uri) VALUES ('old', 't', 'photo', 1, '2027-01-12', 1, 'o', 't')",
    );
    const queue = await createQueue(db);
    await queue.claimUnowned("u1");

    expect((await queue.pending("u1"))[0]).toMatchObject({ id: "old", momentDay: null, pairedWith: null });
  });

  it("stores momentDay and pairedWith", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item({ id: "s", momentDay: "2027-01-12", pairedWith: "m" }));

    expect((await queue.pending("u1"))[0]).toMatchObject({ momentDay: "2027-01-12", pairedWith: "m" });
  });

  it("countPending does not count moment rows, per day or total", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item({ id: "1" }));
    await queue.enqueue(item({ id: "2", momentDay: "2027-01-12" }));
    await queue.enqueue(item({ id: "3", momentDay: "2027-01-12", pairedWith: "2" }));

    expect(await queue.countPending("u1", TRIP, "2027-01-12")).toEqual({ photos: 1, videos: 0 });
    expect(await queue.countPending("u1", TRIP)).toEqual({ photos: 1, videos: 0 });
  });

  it("markFailed on a main also fails the rows paired with it, with the same reason", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item({ id: "m", momentDay: "2027-01-12" }));
    await queue.enqueue(item({ id: "s", momentDay: "2027-01-12", pairedWith: "m" }));
    await queue.markFailed("m", "El rollo ya se reveló");

    expect(await queue.pending("u1")).toEqual([]);
    expect((await queue.failed("u1")).map((f) => [f.id, f.failedReason])).toEqual([
      ["m", "El rollo ya se reveló"],
      ["s", "El rollo ya se reveló"],
    ]);
  });
});

describe("queue per account", () => {
  const OTHER = "u2";

  it("every read only sees the given account's items", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item({ id: "mine" }));
    await queue.enqueue(item({ id: "theirs", ownerUserId: OTHER }));
    await queue.enqueue(item({ id: "mine-failed" }));
    await queue.enqueue(item({ id: "theirs-failed", ownerUserId: OTHER }));
    await queue.markFailed("mine-failed", "quota");
    await queue.markFailed("theirs-failed", "quota");

    expect((await queue.pending("u1")).map((m) => m.id)).toEqual(["mine"]);
    expect((await queue.failed("u1")).map((m) => m.id)).toEqual(["mine-failed"]);
    expect((await queue.pendingForTrip("u1", TRIP)).map((m) => m.id)).toEqual(["mine"]);
    expect((await queue.failedForTrip("u1", TRIP)).map((m) => m.id)).toEqual(["mine-failed"]);
    expect(await queue.countPendingForTrip("u1", TRIP)).toBe(1);
    expect(await queue.countPending("u1", TRIP, "2027-01-12")).toEqual({ photos: 1, videos: 0 });
    expect(await queue.countPending("u1", TRIP)).toEqual({ photos: 1, videos: 0 });
    expect((await queue.pending(OTHER)).map((m) => m.id)).toEqual(["theirs"]);
  });

  it("claimUnowned gives the rows without an owner to the account and leaves other accounts' alone", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item({ id: "old", ownerUserId: null }));
    await queue.enqueue(item({ id: "theirs", ownerUserId: OTHER }));

    expect(await queue.pending("u1")).toEqual([]);
    await queue.claimUnowned("u1");

    expect((await queue.pending("u1")).map((m) => m.id)).toEqual(["old"]);
    expect((await queue.pending(OTHER)).map((m) => m.id)).toEqual(["theirs"]);
  });

  it("removeAllForOwner deletes that account's rows (failed ones too), returns their ids and keeps the others", async () => {
    const queue = await createQueue(memoryDb());
    await queue.enqueue(item({ id: "a" }));
    await queue.enqueue(item({ id: "b" }));
    await queue.enqueue(item({ id: "c", ownerUserId: OTHER }));
    await queue.markFailed("b", "quota");

    expect((await queue.removeAllForOwner("u1")).sort()).toEqual(["a", "b"]);

    expect(await queue.pending("u1")).toEqual([]);
    expect(await queue.failed("u1")).toEqual([]);
    expect((await queue.pending(OTHER)).map((m) => m.id)).toEqual(["c"]);
  });

  it("migrates a database that has the moment columns but no owner column", async () => {
    const db = memoryDb();
    await db.execAsync(`CREATE TABLE pending_media (
      id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL, type TEXT NOT NULL, taken_at INTEGER NOT NULL,
      day TEXT NOT NULL, lat REAL, lng REAL, accuracy_m REAL, caption TEXT, duration_s REAL, width INTEGER,
      height INTEGER, size_bytes INTEGER NOT NULL, original_uri TEXT NOT NULL, thumb_uri TEXT NOT NULL,
      thumbhash TEXT, attempts INTEGER NOT NULL DEFAULT 0, retry_at INTEGER, failed_reason TEXT,
      moment_day TEXT, paired_with TEXT);`);
    await db.runAsync(
      "INSERT INTO pending_media (id, trip_id, type, taken_at, day, size_bytes, original_uri, thumb_uri) VALUES ('old', 't', 'photo', 1, '2027-01-12', 1, 'o', 't')",
    );

    const queue = await createQueue(db);

    expect(await queue.pending("u1")).toEqual([]);
    await queue.claimUnowned("u1");
    expect((await queue.pending("u1"))[0]).toMatchObject({ id: "old", ownerUserId: "u1" });
  });
});
