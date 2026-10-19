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
    getToken: async (tripId) => (tripId === TRIP ? "tok" : null),
    putFile: async (uri, url, contentType) => {
      puts.push({ uri, url, contentType });
      const status = putStatus(url);
      if (status instanceof Error) throw status;
      return status;
    },
    fileExists: async (uri) => !missing.has(uri),
    removeFiles: async (id) => {
      removed.push(id);
    },
    now: () => now,
  };
});

/** Server feliz: registra con URLs y confirma. */
function happyServer() {
  routes.push((c) => {
    if (c.method === "POST" && c.url.endsWith(`/trips/${TRIP}/media`)) return registered((c.body as { id: string }).id);
    if (c.method === "POST" && c.url.endsWith("/complete")) {
      return json(200, { id: c.url.split("/").at(-2), status: "uploaded" });
    }
  });
}

describe("uploader", () => {
  it("registra, sube original y thumb, confirma y limpia cola y archivos", async () => {
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

  it("avisa cada subida confirmada, con el viaje, después de limpiar la cola", async () => {
    happyServer();
    await queue.enqueue(item());
    const uploaded: Array<{ tripId: string; pending: number }> = [];
    deps.onUploaded = async (tripId) => {
      uploaded.push({ tripId, pending: (await queue.pending()).length });
    };

    await createUploader(deps).run();

    expect(uploaded).toEqual([{ tripId: TRIP, pending: 0 }]);
  });

  it("avisa cuando descarta una foto para siempre, con el viaje, después de marcarla fallida", async () => {
    routes.push((c) => (c.method === "POST" && c.url.endsWith("/media") ? json(409, { error: "El rollo ya se reveló" }) : undefined));
    await queue.enqueue(item());
    const discarded: Array<{ tripId: string; pending: number }> = [];
    deps.onDiscarded = async (tripId) => {
      discarded.push({ tripId, pending: await queue.countPendingForTrip(tripId) });
    };

    await createUploader(deps).run();

    expect(discarded).toEqual([{ tripId: TRIP, pending: 0 }]);
  });

  it("registra con el token del viaje y todos los datos de la captura", async () => {
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
      thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
    });
    expect(calls[1]!.auth).toBe("Bearer tok");
  });

  it("sube los videos como video/mp4", async () => {
    happyServer();
    await queue.enqueue(item({ type: "video", durationS: 9.5, originalUri: "file:///docs/pending/a/original.mp4" }));

    await createUploader(deps).run();

    expect(puts.map((p) => p.contentType)).toEqual(["video/mp4", "image/jpeg"]);
  });

  it("sube en el orden en que se sacó", async () => {
    happyServer();
    await queue.enqueue(item({ id: "b", takenAt: 2000 }));
    await queue.enqueue(item({ id: "a", takenAt: 1000 }));

    await createUploader(deps).run();

    expect(calls.filter((c) => c.url.endsWith("/complete")).map((c) => c.url)).toEqual([
      `${API}/media/a/complete`,
      `${API}/media/b/complete`,
    ]);
  });

  it("si el server dice que ya estaba subida, salta directo a limpiar", async () => {
    routes.push((c) => json(200, { id: item().id, status: "uploaded" }));
    await queue.enqueue(item());

    await createUploader(deps).run();

    expect(restCalls()).toEqual([`POST /trips/${TRIP}/media`]);
    expect(puts).toEqual([]);
    expect(await queue.pending()).toEqual([]);
    expect(removed).toEqual([item().id]);
  });

  describe("sin red o server caído", () => {
    it("sin red deja el ítem, suma un intento y difiere el próximo 1 s", async () => {
      globalThis.fetch = jest.fn(async () => {
        throw new TypeError("Network request failed");
      }) as typeof fetch;
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(await queue.pending()).toEqual([expect.objectContaining({ attempts: 1, retryAt: NOW + 1000 })]);
      expect(removed).toEqual([]);
    });

    it("sin red no sigue golpeando con los demás ítems", async () => {
      globalThis.fetch = jest.fn(async () => {
        throw new TypeError("Network request failed");
      }) as typeof fetch;
      await queue.enqueue(item({ id: "a", takenAt: 1 }));
      await queue.enqueue(item({ id: "b", takenAt: 2 }));

      await createUploader(deps).run();

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("un 5xx al registrar es un intento fallido", async () => {
      routes.push(() => json(503, { error: "caído" }));
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(await queue.pending()).toEqual([expect.objectContaining({ attempts: 1, retryAt: NOW + 1000 })]);
    });

    it("un 5xx del PUT es un intento fallido y no confirma", async () => {
      happyServer();
      putStatus = () => 502;
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(restCalls()).toEqual([`POST /trips/${TRIP}/media`]);
      expect(await queue.pending()).toEqual([expect.objectContaining({ attempts: 1 })]);
      expect(removed).toEqual([]);
    });

    it("el PUT sin red (el archivo no llegó a salir) es un intento fallido", async () => {
      happyServer();
      putStatus = () => new Error("network");
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(await queue.pending()).toEqual([expect.objectContaining({ attempts: 1 })]);
    });

    it("un 5xx al confirmar deja el ítem para reintentar", async () => {
      routes.push((c) => (c.url.endsWith("/complete") ? json(500, { error: "x" }) : undefined));
      happyServer();
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(await queue.pending()).toEqual([expect.objectContaining({ attempts: 1 })]);
      expect(removed).toEqual([]);
    });

    it("no reintenta un ítem antes de su hora de retry y sí después", async () => {
      happyServer();
      await queue.enqueue(item());
      await queue.markAttempt(item().id, NOW + 5000);

      await createUploader(deps).run();
      expect(calls).toEqual([]);

      now = NOW + 5000;
      await createUploader(deps).run();
      expect(await queue.pending()).toEqual([]);
    });

    it("el backoff duplica: 1, 2, 4… hasta 5 minutos", () => {
      expect([1, 2, 3, 4, 8, 9, 10, 20].map(retryDelay)).toEqual([
        1000, 2000, 4000, 8000, 128_000, 256_000, 300_000, 300_000,
      ]);
    });

    it("los reintentos fallidos van subiendo el backoff", async () => {
      routes.push(() => json(503, { error: "caído" }));
      await queue.enqueue(item());

      await createUploader(deps).run();
      now += 1000;
      await createUploader(deps).run();

      expect(await queue.pending()).toEqual([expect.objectContaining({ attempts: 2, retryAt: now + 2000 })]);
    });
  });

  describe("URL vencida", () => {
    it("si el PUT da 403, vuelve a registrar y sube a las URLs nuevas", async () => {
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

    it("si después de volver a registrar sigue en 403, lo deja para más tarde", async () => {
      happyServer();
      putStatus = () => 403;
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(calls.filter((c) => c.url.endsWith(`/trips/${TRIP}/media`))).toHaveLength(2);
      expect(await queue.pending()).toEqual([expect.objectContaining({ attempts: 1 })]);
    });
  });

  describe("rechazos del server", () => {
    it("429 (cupo): lo marca fallido para siempre, no lo reintenta y no borra archivos", async () => {
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
      "409 al registrar (%s): falla definitiva con el motivo del server y no borra archivos",
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

    it("404 al confirmar (el admin la borró): falla 'deleted' sin reintentos", async () => {
      routes.push((c) => (c.url.endsWith("/complete") ? json(404, { error: "No existe" }) : undefined));
      happyServer();
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(await queue.failed()).toEqual([
        expect.objectContaining({ failedReason: "deleted", attempts: 0, retryAt: null }),
      ]);
      expect(removed).toEqual([]);
    });

    it("otros 4xx al confirmar (archivo que no llegó) siguen reintentándose", async () => {
      routes.push((c) => (c.url.endsWith("/complete") ? json(400, { error: "Falta el archivo" }) : undefined));
      happyServer();
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(await queue.pending()).toEqual([expect.objectContaining({ attempts: 1 })]);
    });

    it("un fallido no frena a los demás ítems", async () => {
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

    it("sin token del viaje (ya no está en él) lo marca fallido sin tocar la red", async () => {
      await queue.enqueue(item({ tripId: "otro-viaje" }));

      await createUploader(deps).run();

      expect(calls).toEqual([]);
      expect(await queue.failed()).toEqual([expect.objectContaining({ failedReason: "no_token" })]);
    });

    it("otro 4xx al registrar (datos inválidos, token vencido) también es definitivo", async () => {
      routes.push(() => json(400, { error: "mal" }));
      await queue.enqueue(item());

      await createUploader(deps).run();

      expect(await queue.failed()).toEqual([expect.objectContaining({ failedReason: "http_400" })]);
    });
  });

  describe("ítems que no deben trabar la cola", () => {
    it("si falta el thumb lo marca missing_file y sube el siguiente igual", async () => {
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

    it("si falta el original también", async () => {
      happyServer();
      await queue.enqueue(item());
      missing.add(item().originalUri);

      await createUploader(deps).run();

      expect(await queue.failed()).toEqual([expect.objectContaining({ failedReason: "missing_file" })]);
      expect(removed).toEqual([]);
    });

    it("un error raro en un ítem le suma un intento y no frena a los demás", async () => {
      happyServer();
      await queue.enqueue(item({ id: "a", takenAt: 1 }));
      await queue.enqueue(item({ id: "b", takenAt: 2 }));
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      let first = true;
      const uploader = createUploader({
        ...deps,
        getToken: async (tripId) => {
          if (first) {
            first = false;
            throw new TypeError("raro");
          }
          return deps.getToken(tripId);
        },
      });

      await uploader.run();

      expect(removed).toEqual(["b"]);
      expect(await queue.pending()).toEqual([expect.objectContaining({ id: "a", attempts: 1, retryAt: NOW + 1000 })]);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe("un solo uploader a la vez", () => {
    it("dos run() en simultáneo no suben dos veces el mismo ítem", async () => {
      happyServer();
      await queue.enqueue(item());
      const uploader = createUploader(deps);

      await Promise.all([uploader.run(), uploader.run()]);

      expect(calls.filter((c) => c.url.endsWith("/complete"))).toHaveLength(1);
    });

    it("un run() pedido mientras corre otro levanta lo que se encoló en el medio", async () => {
      happyServer();
      await queue.enqueue(item({ id: "a", takenAt: 1 }));
      const uploader = createUploader({
        ...deps,
        putFile: async (...args) => {
          // Mientras sube la primera, el usuario manda otra foto y se dispara otro run().
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

    it("tras un error inesperado libera el lock", async () => {
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
