import { failureText, nextAttemptText, pendingText, summarize } from "../upload-status";
import type { FailedMedia, PendingMedia } from "../queue";

const pending = (type: "photo" | "video", retryAt: number | null = null): PendingMedia => ({
  id: Math.random().toString(),
  tripId: "t",
  type,
  takenAt: 0,
  day: "2027-01-12",
  lat: null,
  lng: null,
  accuracyM: null,
  caption: null,
  durationS: null,
  width: null,
  height: null,
  sizeBytes: 1,
  originalUri: "",
  thumbUri: "",
  thumbhash: null,
  attempts: 0,
  retryAt,
});

describe("pendingText", () => {
  it.each([
    [{ photos: 1, videos: 0 }, "1 foto esperando señal"],
    [{ photos: 3, videos: 0 }, "3 fotos esperando señal"],
    [{ photos: 0, videos: 1 }, "1 video esperando señal"],
    [{ photos: 0, videos: 2 }, "2 videos esperando señal"],
    [{ photos: 2, videos: 1 }, "2 fotos y 1 video esperando señal"],
    [{ photos: 1, videos: 3 }, "1 foto y 3 videos esperando señal"],
  ])("%j → %s", (counts, text) => {
    expect(pendingText(counts)).toBe(text);
  });
});

describe("failureText", () => {
  it("translates the internal codes", () => {
    expect(failureText("missing_file")).toBe("El archivo ya no está en el celular");
    expect(failureText("deleted")).toBe("El admin la borró");
    expect(failureText("no_token")).toBe("Ya no estás en este rollo");
  });

  it("shows the server's messages as they are", () => {
    expect(failureText("Este rollo ya terminó")).toBe("Este rollo ya terminó");
  });
});

describe("nextAttemptText", () => {
  const now = 1_000_000;
  it("is null with no scheduled retry or one already due", () => {
    expect(nextAttemptText(null, now)).toBeNull();
    expect(nextAttemptText(now - 5, now)).toBeNull();
  });

  it("rounds up to whole minutes, in seconds under a minute", () => {
    expect(nextAttemptText(now + 20_000, now)).toBe("Próximo intento en menos de 1 min");
    expect(nextAttemptText(now + 60_000, now)).toBe("Próximo intento en 1 min");
    expect(nextAttemptText(now + 61_000, now)).toBe("Próximo intento en 2 min");
    expect(nextAttemptText(now + 3 * 3_600_000, now)).toBe("Próximo intento en 3 h");
  });
});

describe("summarize", () => {
  it("counts by type and takes the earliest retry", () => {
    const s = summarize([pending("photo", 500), pending("video", 300), pending("photo")], []);
    expect(s.counts).toEqual({ photos: 2, videos: 1 });
    expect(s.nextRetryAt).toBe(300);
    expect(s.hasAnything).toBe(true);
  });

  it("has nothing when both lists are empty", () => {
    const s = summarize([], []);
    expect(s.counts).toEqual({ photos: 0, videos: 0 });
    expect(s.nextRetryAt).toBeNull();
    expect(s.hasAnything).toBe(false);
  });

  it("counts a failed item as something to show", () => {
    expect(summarize([], [{ ...pending("photo"), failedReason: "deleted" } as FailedMedia]).hasAnything).toBe(true);
  });
});
