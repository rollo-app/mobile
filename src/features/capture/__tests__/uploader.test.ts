import { createQueue, type Queue, type QueuedMedia } from "../queue";
import { createUploader, retryDelay, type UploaderDeps } from "../uploader";
import { memoryDb } from "@/test/sqlite-memory";

const TRIP = "11111111-1111-4111-8111-111111111111";
const API = "https://api.test";
const NOW = 1_800_000_000_000;

const item = (overrides: Partial<QueuedMedia> = {}): QueuedMedia => ({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  tripId: TRIP,
  type: "photo",
  takenAt: 1000,
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
  ...overrides,
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const registered = (id: string, n = 1) =>
  json(201, {
    id,
    status: "pending",
    upload: { original: `https://r2.test/${id}/original?v=${n}`, thumb: `https://r2.test/${id}/thumb?v=${n}` },
    expiresIn: 900,
  });

type Call = { method: string; url: string; body?: unknown; auth: string | null };

let queue: Queue;
let calls: Call[];
let routes: Array<(c: Call) => Response | undefined>;
let puts: Array<{ uri: string; url: string; contentType: string }>;
let putStatus: (url: string) => number | Error;
let removed: string[];
let missing: Set<string>;
let sizes: Map<string, number>;
let now: number;
let deps: UploaderDeps;

const rest = (c: Call) => `${c.method} ${c.url.replace(API, "")}`;
const restCalls = () => calls.map(rest);

beforeEach(async () => {
  queue = await createQueue(memoryDb());
  calls = [];
  puts = [];
  removed = [];
  missing = new Set();
  sizes = new Map([
    ["file:///docs/pending/a/original.jpg", 2_500_000],
    ["file:///docs/pending/a/thumb.jpg", 61_234],
  ]);
  now = NOW;
  putStatus = () => 200;
  routes = [];
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input as string, init);
    const text = await req.text();
    const call: Call = {
      method: req.method,
      url: req.url,
      body: text ? JSON.parse(text) : undefined,
      auth: req.headers.get("authorization"),
    };
    calls.push(call);
    for (const route of routes) {
      const res = route(call);
      if (res) return res;
    }
    throw new Error(`sin ruta para ${rest(call)}`);
  }) as typeof fetch;

  deps = {
    queue,
    apiUrl: API,
    getToken: async () => "tok",
    putFile: async (uri, url, contentType) => {
      puts.push({ uri, url, contentType });
      const status = putStatus(url);
      if (status instanceof Error) throw status;
      return status;
    },
    fileSize: async (uri) => (missing.has(uri) ? null : (sizes.get(uri) ?? 1000)),
    removeFiles: async (id) => {
      removed.push(id);
    },
    now: () => now,
  };
});

/** Happy server: registers with URLs and confirms. */
function happyServer() {
  routes.push((c) => {
    if (c.method === "POST" && c.url.endsWith(`/trips/${TRIP}/media`)) return registered((c.body as { id: string }).id);
    if (c.method === "POST" && c.url.endsWith("/complete")) {
      return json(200, { id: c.url.split("/").at(-2), status: "uploaded" });
    }
  });
}

describe("uploader", () => {
  it("registers, uploads original and thumb, confirms and cleans up queue and files", async () => {
    happyServer();
    await queue.enqueue(item());

    await createUploader(deps).run();

    expect(restCalls()).toEqual([`POST /trips/${TRIP}/media`, `POST /media/${item().id}/complete`]);
    expect(puts).toEqual([
      { uri: item().originalUri, url: `https://r2.test/${item().id}/original?v=1`, contentType: "image/jpeg" },
      { uri: item().thumbUri, url: `https://r2.test/${item().id}/thumb?v=1`, contentType: "image/jpeg" },
    ]);
    expect(await queue.pending()).toEqual([]);
    expect(removed).toEqual([item().id]);
  });

  it("notifies on every confirmed upload, with the trip, after cleaning the queue", async () => {
    happyServer();
    await queue.enqueue(item());
    const uploaded: Array<{ tripId: string; pending: number }> = [];
    deps.onUploaded = async (tripId) => {
      uploaded.push({ tripId, pending: (await queue.pending()).length });
    };

    await createUploader(deps).run();

    expect(uploaded).toEqual([{ tripId: TRIP, pending: 0 }]);
  });

  it("notifies when it permanently discards a photo, with the trip, after marking it failed", async () => {
    routes.push((c) => (c.method === "POST" && c.url.endsWith("/media") ? json(409, { error: "El rollo ya se reveló" }) : undefined));
    await queue.enqueue(item());
    const discarded: Array<{ tripId: string; pending: number }> = [];
    deps.onDiscarded = async (tripId) => {
      discarded.push({ tripId, pending: await queue.countPendingForTrip(tripId) });
    };

    await createUploader(deps).run();

    expect(discarded).toEqual([{ tripId: TRIP, pending: 0 }]);
  });

  it("registers with the trip token and all the capture data", async () => {
    happyServer();
    await queue.enqueue(item());

    await createUploader(deps).run();

    expect(calls[0]!.auth).toBe("Bearer tok");
    expect(calls[0]!.body).toEqual({
      id: item().id,
      type: "photo",
      takenAt: 1000,
      lat: -49.33,
      lng: -72.89,
      accuracyM: 12,
      caption: "el viento no perdona",
      durationS: null,
      width: 4000,
      height: 3000,
      sizeBytes: 2_500_000,
      thumbSizeBytes: 61_234,
      thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
      momentDay: null,
      pairedMediaId: null,
    });
    expect(calls[1]!.auth).toBe("Bearer tok");
  });

  it("declares the exact byte size of the files on disk, not the one stored at capture", async () => {
    // The URLs are signed for that exact Content-Length, and the PUT sends the whole file.
    happyServer();
    await queue.enqueue(item({ sizeBytes: 0 }));
    sizes.set(item().originalUri, 2_400_321);
    sizes.set(item().thumbUri, 70_001);

    await createUploader(deps).run();

    expect(calls[0]!.body).toMatchObject({ sizeBytes: 2_400_321, thumbSizeBytes: 70_001 });
  });

  it("uploads videos as video/mp4", async () => {
    happyServer();
    await queue.enqueue(item({ type: "video", durationS: 9.5, originalUri: "file:///docs/pending/a/original.mp4" }));

    await createUploader(deps).run();

    expect(puts.map((p) => p.contentType)).toEqual(["video/mp4", "image/jpeg"]);
  });

  it("uploads in the order they were shot", async () => {
    happyServer();
    await queue.enqueue(item({ id: "b", takenAt: 2000 }));
    await queue.enqueue(item({ id: "a", takenAt: 1000 }));

    await createUploader(deps).run();

    expect(calls.filter((c) => c.url.endsWith("/complete")).map((c) => c.url)).toEqual([
      `${API}/media/a/complete`,
      `${API}/media/b/complete`,
    ]);
  });

  it("if the server says it was already uploaded, it jumps straight to cleanup", async () => {
    routes.push((c) => json(200, { id: item().id, status: "uploaded" }));
    await queue.enqueue(item());

    await createUploader(deps).run();

    expect(restCalls()).toEqual([`POST /trips/${TRIP}/media`]);
    expect(puts).toEqual([]);
    expect(await queue.pending()).toEqual([]);
    expect(removed).toEqual([item().id]);
  });

  describe("no network or server down", () => {
    it("with no network it keeps the item, adds an attempt and defers the next one by 1 s", async () => {
      globalThis.fetch = jest.fn(async () => {
        throw new TypeError("Network request failed");
      }) as typeof fetch;
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(await queue.pending()).toEqual([expect.objectContaining({ attempts: 1, retryAt: NOW + 1000 })]);
      expect(removed).toEqual([]);
    });

    it("with no network it does not keep hitting with the other items", async () => {
      globalThis.fetch = jest.fn(async () => {
        throw new TypeError("Network request failed");
      }) as typeof fetch;
      await queue.enqueue(item({ id: "a", takenAt: 1 }));
      await queue.enqueue(item({ id: "b", takenAt: 2 }));

      await createUploader(deps).run();

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("a 5xx on register is a failed attempt", async () => {
      routes.push(() => json(503, { error: "caído" }));
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(await queue.pending()).toEqual([expect.objectContaining({ attempts: 1, retryAt: NOW + 1000 })]);
    });

    it("a 5xx on the PUT is a failed attempt and does not confirm", async () => {
      happyServer();
      putStatus = () => 502;
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(restCalls()).toEqual([`POST /trips/${TRIP}/media`]);
      expect(await queue.pending()).toEqual([expect.objectContaining({ attempts: 1 })]);
      expect(removed).toEqual([]);
    });

    it("the PUT with no network (the file never went out) is a failed attempt", async () => {
      happyServer();
      putStatus = () => new Error("network");
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(await queue.pending()).toEqual([expect.objectContaining({ attempts: 1 })]);
    });

    it("a 5xx on confirm leaves the item to retry", async () => {
      routes.push((c) => (c.url.endsWith("/complete") ? json(500, { error: "x" }) : undefined));
      happyServer();
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(await queue.pending()).toEqual([expect.objectContaining({ attempts: 1 })]);
      expect(removed).toEqual([]);
    });

    it("does not retry an item before its retry time, and does after", async () => {
      happyServer();
      await queue.enqueue(item());
      await queue.markAttempt(item().id, NOW + 5000);

      await createUploader(deps).run();
      expect(calls).toEqual([]);

      now = NOW + 5000;
      await createUploader(deps).run();
      expect(await queue.pending()).toEqual([]);
    });

    it("ignoreBackoff uploads items whose retry time is still in the future", async () => {
      happyServer();
      await queue.enqueue(item());
      await queue.markAttempt(item().id, NOW + 5 * 60_000);

      await createUploader(deps).run({ ignoreBackoff: true });

      expect(await queue.pending()).toEqual([]);
    });

    it("ignoreBackoff requested during a run applies to the follow-up pass", async () => {
      happyServer();
      await queue.enqueue(item());
      await queue.markAttempt(item().id, NOW + 5 * 60_000);
      const uploader = createUploader(deps);

      // A normal run is in flight (it skips the item); the network comes back meanwhile.
      const first = uploader.run();
      const second = uploader.run({ ignoreBackoff: true });
      await Promise.all([first, second]);

      expect(await queue.pending()).toEqual([]);
    });

    it("backoff doubles: 1, 2, 4… up to 5 minutes", () => {
      expect([1, 2, 3, 4, 8, 9, 10, 20].map(retryDelay)).toEqual([
        1000, 2000, 4000, 8000, 128_000, 256_000, 300_000, 300_000,
      ]);
    });

    it("failed retries keep raising the backoff", async () => {
      routes.push(() => json(503, { error: "caído" }));
      await queue.enqueue(item());

      await createUploader(deps).run();
      now += 1000;
      await createUploader(deps).run();

      expect(await queue.pending()).toEqual([expect.objectContaining({ attempts: 2, retryAt: now + 2000 })]);
    });
  });

  describe("expired URL", () => {
    it("if the PUT returns 403, it registers again and uploads to the new URLs", async () => {
      let registers = 0;
      routes.push((c) => {
        if (c.method === "POST" && c.url.endsWith(`/trips/${TRIP}/media`)) {
          registers += 1;
          return registered(item().id, registers);
        }
        if (c.url.endsWith("/complete")) return json(200, { id: item().id, status: "uploaded" });
      });
      putStatus = (url) => (url.endsWith("v=1") ? 403 : 200);
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(registers).toBe(2);
      expect(puts.at(-1)?.url).toContain("v=2");
      expect(await queue.pending()).toEqual([]);
    });

    it("if it still returns 403 after registering again, it leaves it for later", async () => {
      happyServer();
      putStatus = () => 403;
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(calls.filter((c) => c.url.endsWith(`/trips/${TRIP}/media`))).toHaveLength(2);
      expect(await queue.pending()).toEqual([expect.objectContaining({ attempts: 1 })]);
    });
  });

  describe("server rejections", () => {
    it("429 (quota): marks it failed for good, does not retry it and does not delete files", async () => {
      routes.push(() => json(429, { error: "Se terminó el rollo de hoy" }));
      await queue.enqueue(item());

      await createUploader(deps).run();
      await createUploader(deps).run();

      expect(await queue.pending()).toEqual([]);
      expect(await queue.failed()).toEqual([expect.objectContaining({ id: item().id, failedReason: "quota" })]);
      expect(calls).toHaveLength(1);
      expect(removed).toEqual([]);
    });

    it.each(["El rollo ya se reveló", "El admin borró esta foto"])(
      "409 on register (%s): permanent failure with the server's reason and does not delete files",
      async (message) => {
        routes.push(() => json(409, { error: message }));
        await queue.enqueue(item());

        await createUploader(deps).run();
        await createUploader(deps).run();

        expect(await queue.failed()).toEqual([expect.objectContaining({ failedReason: message })]);
        expect(calls).toHaveLength(1);
        expect(removed).toEqual([]);
      },
    );

    it.each(["Este rollo todavía no empezó", "Este rollo ya terminó"])(
      "400 on register (%s): permanent failure with the server's reason and no retry attempt",
      async (message) => {
        routes.push(() => json(400, { error: message }));
        await queue.enqueue(item());

        await createUploader(deps).run();
        await createUploader(deps).run();

        expect(await queue.pending()).toEqual([]);
        expect(await queue.failed()).toEqual([expect.objectContaining({ failedReason: message, attempts: 0 })]);
        expect(calls).toHaveLength(1);
        expect(removed).toEqual([]);
      },
    );

    it("404 on confirm (the admin deleted it): fails 'deleted' with no retries", async () => {
      routes.push((c) => (c.url.endsWith("/complete") ? json(404, { error: "No existe" }) : undefined));
      happyServer();
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(await queue.failed()).toEqual([
        expect.objectContaining({ failedReason: "deleted", attempts: 0, retryAt: null }),
      ]);
      expect(removed).toEqual([]);
    });

    it("other 4xx on confirm (file that never arrived) keep being retried", async () => {
      routes.push((c) => (c.url.endsWith("/complete") ? json(400, { error: "Falta el archivo" }) : undefined));
      happyServer();
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(await queue.pending()).toEqual([expect.objectContaining({ attempts: 1 })]);
    });

    it("a failed item does not block the other items", async () => {
      routes.push((c) =>
        c.method === "POST" && (c.body as { id: string } | undefined)?.id === "a" ? json(429, { error: "x" }) : undefined,
      );
      happyServer();
      await queue.enqueue(item({ id: "a", takenAt: 1 }));
      await queue.enqueue(item({ id: "b", takenAt: 2 }));

      await createUploader(deps).run();

      expect((await queue.failed()).map((m) => m.id)).toEqual(["a"]);
      expect(await queue.pending()).toEqual([]);
      expect(removed).toEqual(["b"]);
    });

    it("signed out it doesn't touch the network or the queue", async () => {
      await queue.enqueue(item());

      await createUploader({ ...deps, getToken: async () => null }).run();

      expect(calls).toEqual([]);
      expect(await queue.pending()).toHaveLength(1);
      expect(await queue.failed()).toEqual([]);
    });

    it("a 401 (session rejected) stops the pass and keeps the photos in the queue", async () => {
      routes.push(() => json(401, { error: "Sesión inválida, volvé a entrar" }));
      await queue.enqueue(item({ id: "a", takenAt: 1 }));
      await queue.enqueue(item({ id: "b", takenAt: 2 }));

      await createUploader(deps).run();

      expect(calls).toHaveLength(1);
      expect(await queue.failed()).toEqual([]);
      expect(await queue.pending()).toHaveLength(2);
    });

    it("another 4xx on register (invalid data, expired token) is also permanent, with the server message as reason", async () => {
      routes.push(() => json(400, { error: "mal" }));
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(await queue.failed()).toEqual([expect.objectContaining({ failedReason: "mal" })]);
    });
  });

  describe("items that must not jam the queue", () => {
    it("if the thumb is missing it marks missing_file and uploads the next one anyway", async () => {
      happyServer();
      await queue.enqueue(item({ id: "a", takenAt: 1, thumbUri: "file:///docs/pending/a/thumb.jpg" }));
      await queue.enqueue(item({ id: "b", takenAt: 2, originalUri: "file:///b/o.jpg", thumbUri: "file:///b/t.jpg" }));
      missing.add("file:///docs/pending/a/thumb.jpg");

      await createUploader(deps).run();

      expect(await queue.failed()).toEqual([expect.objectContaining({ id: "a", failedReason: "missing_file" })]);
      expect(await queue.pending()).toEqual([]);
      expect(removed).toEqual(["b"]);
      expect(calls.some((c) => c.url.includes("/a/") || (c.body as { id?: string } | undefined)?.id === "a")).toBe(false);
    });

    it("same if the original is missing", async () => {
      happyServer();
      await queue.enqueue(item());
      missing.add(item().originalUri);

      await createUploader(deps).run();

      expect(await queue.failed()).toEqual([expect.objectContaining({ failedReason: "missing_file" })]);
      expect(removed).toEqual([]);
    });

    it("an odd error on an item adds an attempt to it and does not block the others", async () => {
      happyServer();
      await queue.enqueue(item({ id: "a", takenAt: 1 }));
      await queue.enqueue(item({ id: "b", takenAt: 2 }));
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      let first = true;
      const uploader = createUploader({
        ...deps,
        getToken: async () => {
          if (first) {
            first = false;
            throw new TypeError("raro");
          }
          return deps.getToken();
        },
      });

      await uploader.run();

      expect(removed).toEqual(["b"]);
      expect(await queue.pending()).toEqual([expect.objectContaining({ id: "a", attempts: 1, retryAt: NOW + 1000 })]);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe("only one uploader at a time", () => {
    it("two simultaneous run() calls do not upload the same item twice", async () => {
      happyServer();
      await queue.enqueue(item());
      const uploader = createUploader(deps);

      await Promise.all([uploader.run(), uploader.run()]);

      expect(calls.filter((c) => c.url.endsWith("/complete"))).toHaveLength(1);
    });

    it("a run() requested while another is running picks up what was enqueued in between", async () => {
      happyServer();
      await queue.enqueue(item({ id: "a", takenAt: 1 }));
      const uploader = createUploader({
        ...deps,
        putFile: async (...args) => {
          // While the first uploads, the user sends another photo and another run() fires.
          if (!(await queue.pending()).some((m) => m.id === "b")) {
            await queue.enqueue(item({ id: "b", takenAt: 2 }));
            void uploader.run();
          }
          return deps.putFile(...args);
        },
      });

      await uploader.run();

      expect(await queue.pending()).toEqual([]);
      expect(removed.sort()).toEqual(["a", "b"]);
    });

    it("after an unexpected error it releases the lock", async () => {
      happyServer();
      await queue.enqueue(item());
      let fail = true;
      const flaky = {
        ...queue,
        pending: async () => {
          if (fail) {
            fail = false;
            throw new Error("db");
          }
          return queue.pending();
        },
      };
      const uploader = createUploader({ ...deps, queue: flaky });

      await expect(uploader.run()).rejects.toThrow("db");
      await uploader.run();

      expect(await queue.pending()).toEqual([]);
    });
  });
});

describe("uploader deadline", () => {
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  it("does not start a new item once the deadline has passed and leaves the rest pending", async () => {
    happyServer();
    await queue.enqueue(item({ id: A, takenAt: 1 }));
    await queue.enqueue(item({ id: B, takenAt: 2 }));
    await queue.enqueue(item({ id: C, takenAt: 3 }));
    // Each PUT "takes" 10 s; the deadline allows for one item only.
    const putFile = deps.putFile;
    deps.putFile = async (...args) => {
      now += 10_000;
      return putFile(...args);
    };

    await createUploader(deps).run({ deadline: NOW + 15_000 });

    // A finishes at +20 s (two PUTs), past the deadline: B and C never start.
    expect((await queue.pending()).map((m) => m.id).sort()).toEqual([B, C]);
    expect(removed).toEqual([A]);
    expect(restCalls().filter((c) => c.endsWith("/media"))).toHaveLength(1);
  });

  it("does nothing when the deadline has already passed", async () => {
    happyServer();
    await queue.enqueue(item());

    await createUploader(deps).run({ deadline: NOW });

    expect(calls).toEqual([]);
    expect(await queue.pending()).toHaveLength(1);
  });

  it("uploads everything when there is no deadline", async () => {
    happyServer();
    await queue.enqueue(item({ id: A, takenAt: 1 }));
    await queue.enqueue(item({ id: B, takenAt: 2 }));

    await createUploader(deps).run();

    expect(await queue.pending()).toEqual([]);
  });

  it("an item cut by the deadline is picked up by the next run with no leftovers", async () => {
    happyServer();
    await queue.enqueue(item({ id: A, takenAt: 1 }));
    await queue.enqueue(item({ id: B, takenAt: 2 }));
    const uploader = createUploader(deps);

    await uploader.run({ deadline: NOW });
    expect(await queue.pending()).toHaveLength(2);
    await uploader.run();

    expect(await queue.pending()).toEqual([]);
    expect(removed.sort()).toEqual([A, B]);
  });
});

describe("uploader: moments", () => {
  const MAIN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const SELFIE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const moment = (id: string, extra: Partial<QueuedMedia> = {}) =>
    item({ id, momentDay: "2027-01-12", takenAt: id === MAIN ? 1000 : 2000, ...extra });

  it("sends momentDay and pairedMediaId in the register request; a normal photo carries null", async () => {
    happyServer();
    await queue.enqueue(item());
    await queue.enqueue(moment(MAIN));
    await queue.enqueue(moment(SELFIE, { pairedWith: MAIN }));

    await createUploader(deps).run();

    const bodies = calls.filter((c) => c.url.endsWith("/media")).map((c) => c.body as Record<string, unknown>);
    expect(bodies[0]).toMatchObject({ id: item().id, momentDay: null, pairedMediaId: null });
    expect(bodies[1]).toMatchObject({ id: MAIN, momentDay: "2027-01-12", pairedMediaId: null });
    expect(bodies[2]).toMatchObject({ id: SELFIE, momentDay: "2027-01-12", pairedMediaId: MAIN });
  });

  it("does not upload the selfie while its main is still in the queue, and does after the main completes", async () => {
    // The selfie was shot "before" the main (older takenAt) to prove ordering is by pairing, not time.
    happyServer();
    await queue.enqueue(moment(MAIN, { takenAt: 5000 }));
    await queue.enqueue(moment(SELFIE, { pairedWith: MAIN, takenAt: 1000 }));
    // The main fails once with a server error: it stays pending.
    let first = true;
    routes.unshift((c) => {
      if (first && c.method === "POST" && c.url.endsWith("/media") && (c.body as { id: string }).id === MAIN) {
        first = false;
        return json(500, { error: "boom" });
      }
    });

    await createUploader(deps).run();
    const registeredIds = () => calls.filter((c) => c.url.endsWith("/media")).map((c) => (c.body as { id: string }).id);
    expect(registeredIds()).toEqual([MAIN]);
    expect((await queue.pending()).map((m) => m.id).sort()).toEqual([MAIN, SELFIE].sort());

    now += 10 * 60_000;
    await createUploader(deps).run();

    expect(registeredIds()).toEqual([MAIN, MAIN, SELFIE]);
    expect(await queue.pending()).toEqual([]);
  });

  it("when the main fails for good, the selfie fails with the same reason and is not uploaded", async () => {
    routes.push((c) =>
      c.method === "POST" && c.url.endsWith("/media") ? json(409, { error: "Ya sacaste tu momento de hoy" }) : undefined,
    );
    await queue.enqueue(moment(MAIN));
    await queue.enqueue(moment(SELFIE, { pairedWith: MAIN }));

    await createUploader(deps).run();

    expect(calls.filter((c) => c.url.endsWith("/media"))).toHaveLength(1);
    expect(await queue.pending()).toEqual([]);
    expect((await queue.failed()).map((f) => [f.id, f.failedReason])).toEqual([
      [MAIN, "Ya sacaste tu momento de hoy"],
      [SELFIE, "Ya sacaste tu momento de hoy"],
    ]);
  });

  it("uploads a selfie whose main is no longer in the queue (already uploaded)", async () => {
    happyServer();
    await queue.enqueue(moment(SELFIE, { pairedWith: MAIN }));

    await createUploader(deps).run();

    expect(await queue.pending()).toEqual([]);
    expect(calls[0]!.body).toMatchObject({ pairedMediaId: MAIN });
  });

  it("a 400 on register (invalid pairing) fails the item for good", async () => {
    routes.push((c) => (c.method === "POST" && c.url.endsWith("/media") ? json(400, { error: "Emparejado inválido" }) : undefined));
    await queue.enqueue(moment(SELFIE, { pairedWith: MAIN }));

    await createUploader(deps).run();

    expect(await queue.failed()).toEqual([expect.objectContaining({ id: SELFIE, failedReason: "Emparejado inválido" })]);
  });
});
