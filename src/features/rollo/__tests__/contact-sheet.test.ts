import { buildContactSheet } from "../contact-sheet";

const f = (takenAt: number, thumbhash: string | null) => ({ takenAt, thumbhash });

describe("buildContactSheet", () => {
  it("ordena de la más nueva a la más vieja mezclando subidas y pendientes", () => {
    const sheet = buildContactSheet({
      feed: [f(10, "a"), f(30, "c")],
      pending: [f(20, "b"), f(40, "d")],
      total: 4,
    });
    expect(sheet.frames).toEqual(["d", "c", "b", "a"]);
    expect(sheet.rest).toBe(0);
  });

  it("deja null donde no hay thumbhash", () => {
    const sheet = buildContactSheet({ feed: [f(2, null), f(1, "a")], pending: [], total: 2 });
    expect(sheet.frames).toEqual([null, "a"]);
  });

  it("completa con null si el total es mayor a lo que se conoce", () => {
    const sheet = buildContactSheet({ feed: [f(1, "a")], pending: [], total: 3 });
    expect(sheet.frames).toEqual(["a", null, null]);
  });

  it("limita a 18 cuadros y cuenta el resto", () => {
    const feed = Array.from({ length: 25 }, (_, i) => f(i, `h${i}`));
    const sheet = buildContactSheet({ feed, pending: [], total: 25 });
    expect(sheet.frames).toHaveLength(18);
    expect(sheet.frames[0]).toBe("h24");
    expect(sheet.rest).toBe(7);
  });

  it("sin nada en el rollo no hay cuadros", () => {
    expect(buildContactSheet({ feed: [], pending: [], total: 0 })).toEqual({ frames: [], rest: 0 });
  });

  it("un límite menor al total ignora lo que sobra del feed", () => {
    const sheet = buildContactSheet({ feed: [f(1, "a"), f(2, "b")], pending: [], total: 1 });
    expect(sheet.frames).toEqual(["b"]);
  });
});
