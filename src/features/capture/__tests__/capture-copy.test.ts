import { closedMessage, mediaTypesFor } from "../capture-copy";

const HOUR = 60 * 60 * 1000;
const trip = (over: Partial<Parameters<typeof closedMessage>[0]> = {}) => ({
  startsAt: 10 * HOUR,
  endsAt: 20 * HOUR,
  revealAt: 20 * HOUR,
  revealed: false,
  timezone: "America/Argentina/Buenos_Aires",
  ...over,
});

describe("closedMessage", () => {
  it("returns null while the roll is active", () => {
    expect(closedMessage(trip(), 15 * HOUR)).toBeNull();
  });

  it("says the roll hasn't started before the start", () => {
    const message = closedMessage(trip(), 5 * HOUR);
    expect(message?.title).toBe("Este rollo todavía no empezó");
    expect(message?.body).toMatch(/^Arranca el .* a las .*\.$/);
  });

  it("says when it reveals after the end", () => {
    const message = closedMessage(trip(), 25 * HOUR);
    expect(message?.title).toBe("Este rollo ya terminó");
    expect(message?.body).toMatch(/^Se revela el /);
  });

  it("says it's revealed once revealed", () => {
    expect(closedMessage(trip({ revealed: true }), 25 * HOUR)).toEqual({
      title: "Este rollo ya se reveló",
      body: "Ya no se pueden sacar fotos.",
    });
  });
});

describe("mediaTypesFor", () => {
  it("offers both when the quota is unknown or not exhausted", () => {
    expect(mediaTypesFor(null)).toEqual(["images", "videos"]);
    expect(mediaTypesFor({ photos: 2, videos: 1 })).toEqual(["images", "videos"]);
  });

  it("offers only photos when no videos are left", () => {
    expect(mediaTypesFor({ photos: 2, videos: 0 })).toEqual(["images"]);
  });

  it("offers only videos when no photos are left", () => {
    expect(mediaTypesFor({ photos: 0, videos: 2 })).toEqual(["videos"]);
  });
});
