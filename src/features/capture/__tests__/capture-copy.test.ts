import { closedMessage, exhaustedMessage, photosLeftText } from "../capture-copy";

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

describe("exhaustedMessage", () => {
  it("says tomorrow's photos in a daily rollo, and treats a cached detail with no mode as daily", () => {
    expect(exhaustedMessage({ photoLimitMode: "daily", dailyPhotoLimit: 10 })).toEqual({
      title: "Se terminó el rollo de hoy",
      body: "Mañana tenés 10 fotos nuevas.",
    });
    expect(exhaustedMessage({ dailyPhotoLimit: 1 }).body).toBe("Mañana tenés 1 foto nueva.");
    expect(exhaustedMessage(null).body).toBe("Mañana se renueva.");
  });

  it("says you used all of the rollo's photos in a total rollo", () => {
    expect(exhaustedMessage({ photoLimitMode: "total", dailyPhotoLimit: 10 }).title).toBe("Ya usaste todas tus fotos del rollo");
  });
});

describe("photosLeftText", () => {
  it("counts today's or the rollo's photos, in singular and plural", () => {
    expect(photosLeftText(7, "daily")).toBe("Tenés 7 fotos hoy.");
    expect(photosLeftText(1, undefined)).toBe("Tenés 1 foto hoy.");
    expect(photosLeftText(18, "total")).toBe("Tenés 18 fotos en el rollo.");
  });
});
