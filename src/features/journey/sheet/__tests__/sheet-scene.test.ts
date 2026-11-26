import { FILM_FRAME } from "../../route";
import { buildSheetScene, sheetColumns, sheetFrameAt, shownCells, type SheetCellInput, type SheetInput } from "../sheet-scene";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const BASE = Date.UTC(2026, 11, 12, 20, 0);

function cell(i: number, opts: { dayOf?: (i: number) => number } = {}): SheetCellInput {
  const takenAt = BASE + i * 10 * 60_000;
  const minutes = (20 * 60 + i * 10) % 1440;
  return {
    id: `c${i}`,
    takenAt,
    localMinutes: minutes,
    day: opts.dayOf ? opts.dayOf(i) : 1,
    author: { initial: i % 2 ? "J" : "R", color: "#3155F5", avatar: null },
  };
}

const cellsOf = (n: number, opts?: { dayOf?: (i: number) => number }) => Array.from({ length: n }, (_, i) => cell(i, opts));

function makeInput(n: number, highlightIdx: number[], extra: Partial<SheetInput> = {}): SheetInput {
  const cells = cellsOf(n);
  return {
    frame: FILM_FRAME,
    seed: 7,
    name: "Casamiento",
    dateLine: "12 dic 2026 · 25 fotos",
    closingLine: "25 fotos · 8 destacadas",
    cells,
    highlights: highlightIdx.map((i) => `c${i}`),
    ...extra,
  };
}

const spread = (k: number, n: number) => Array.from({ length: k }, (_, i) => Math.floor((i * n) / k));

describe("sheetColumns", () => {
  it.each([
    [1, 3],
    [12, 3],
    [13, 4],
    [20, 4],
    [21, 5],
    [30, 5],
  ])("%i cells use %i columns", (count, cols) => {
    expect(sheetColumns(count)).toBe(cols);
  });
});

describe("shownCells", () => {
  it.each([
    [13, 12],
    [19, 16],
    [21, 20],
    [40, 30],
    [5, 5],
  ])("%i cells without highlights show %i", (count, shown) => {
    expect(shownCells(cellsOf(count), [])).toHaveLength(shown);
  });

  it("never drops a highlight", () => {
    const cells = cellsOf(7);
    const shown = shownCells(cells, cells.map((c) => c.id));
    expect(shown).toHaveLength(7);
  });

  it("drops the last cells that are not highlights", () => {
    const cells = cellsOf(14);
    // 14 -> 12 shown: two dropped; c13 is a highlight so c12 and c11 go.
    const shown = shownCells(cells, ["c13", "c0"]).map((c) => c.id);
    expect(shown).toHaveLength(12);
    expect(shown).not.toContain("c12");
    expect(shown).not.toContain("c11");
    expect(shown).toContain("c13");
  });
});

describe("layout", () => {
  const scene = buildSheetScene(makeInput(25, spread(8, 25)));
  const { cellW, cellH, cells } = scene.layout;

  it("keeps every cell inside the frame", () => {
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + cellW).toBeLessThanOrEqual(FILM_FRAME.w);
      expect(c.y + cellH).toBeLessThanOrEqual(FILM_FRAME.h);
    }
  });

  it("does not overlap cells", () => {
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i]!;
        const b = cells[j]!;
        const apart = a.x + cellW <= b.x || b.x + cellW <= a.x || a.y + cellH <= b.y || b.y + cellH <= a.y;
        expect(apart).toBe(true);
      }
    }
  });

  it("centres the sheet with 20 point margins and starts below the title", () => {
    const left = Math.min(...cells.map((c) => c.x));
    const right = Math.max(...cells.map((c) => c.x + cellW));
    expect(left).toBeCloseTo(20, 5);
    expect(FILM_FRAME.w - right).toBeCloseTo(20, 5);
    expect(Math.min(...cells.map((c) => c.y))).toBeGreaterThanOrEqual(110);
  });

  it("makes 3:4 cells", () => {
    expect(cellH / cellW).toBeCloseTo(4 / 3, 5);
  });
});

describe("timeline", () => {
  it("adds up with 8 highlights of 25 cells", () => {
    const scene = buildSheetScene(makeInput(25, spread(8, 25)));
    expect(scene.durationMs).toBe(1800 + 2500 + 8 * (800 + 2600) + 1500 + 2600 + 2500);
  });

  it("fits 59 s with 12 highlights", () => {
    const scene = buildSheetScene(makeInput(30, spread(12, 30)));
    expect(scene.durationMs).toBeLessThanOrEqual(59_000);
  });

  it("shrinks the holds with a made-up 20 highlights", () => {
    const scene = buildSheetScene(makeInput(30, spread(20, 30)));
    expect(scene.highlights).toHaveLength(20);
    expect(scene.t.holdMs).toBeLessThan(2600);
    expect(scene.durationMs).toBeLessThanOrEqual(59_000);
  });

  it("handles zero highlights", () => {
    const scene = buildSheetScene(makeInput(25, []));
    expect(scene.durationMs).toBe(1800 + 2500 + 1500 + 2600 + 2500);
    for (let t = 0; t <= scene.durationMs; t += 250) {
      expect(sheetFrameAt(scene, t).title.items).toHaveLength(0);
    }
  });
});

describe("develop", () => {
  const input = makeInput(25, []);
  // Hand the scene the cells shuffled: it must still develop them by time.
  const shuffled = { ...input, cells: [...input.cells].reverse() };
  const scene = buildSheetScene(shuffled);

  it("starts as empty paper", () => {
    for (const c of sheetFrameAt(scene, 0).cells) expect(c.develop).toBeLessThanOrEqual(0);
  });

  it("is fully developed when the develop phase ends", () => {
    for (const c of sheetFrameAt(scene, scene.t.developEnd).cells) expect(c.develop).toBe(1);
  });

  it("develops cells in time order", () => {
    const order = scene.cells.map((c, i) => ({ takenAt: c.takenAt, start: scene.developStart[i]! }));
    order.sort((a, b) => a.takenAt - b.takenAt);
    for (let i = 1; i < order.length; i++) expect(order[i]!.start).toBeGreaterThanOrEqual(order[i - 1]!.start);
    expect(order[0]!.start).toBeLessThan(order[order.length - 1]!.start);
  });
});

describe("holding a highlight", () => {
  const idx = spread(8, 25);
  const scene = buildSheetScene(makeInput(25, idx));
  const slot = scene.t.moveMs + scene.t.holdMs;
  const holdStart = (k: number) => scene.t.developEnd + k * slot + scene.t.moveMs;

  it("centres the cell at (0.5 w, 0.53 h) at 78 % of the width, pushing in at most 5 %", () => {
    scene.highlights.forEach((hl, k) => {
      for (const f of [0, 0.5, 1]) {
        const m = sheetFrameAt(scene, holdStart(k) + f * scene.t.holdMs * 0.999);
        const c = scene.layout.cells[hl.cell]!;
        const cx = m.camera.tx + m.camera.s * (c.x + scene.layout.cellW / 2);
        const cy = m.camera.ty + m.camera.s * (c.y + scene.layout.cellH / 2);
        expect(Math.abs(cx - 0.5 * FILM_FRAME.w)).toBeLessThan(0.5);
        expect(Math.abs(cy - 0.53 * FILM_FRAME.h)).toBeLessThan(0.5);
        const width = m.camera.s * scene.layout.cellW;
        expect(width).toBeGreaterThanOrEqual(0.78 * FILM_FRAME.w - 1e-6);
        expect(width).toBeLessThanOrEqual(0.78 * FILM_FRAME.w * 1.05 + 1e-6);
      }
    });
  });

  it("dims every other cell and leaves the held one clear", () => {
    scene.highlights.forEach((hl, k) => {
      const m = sheetFrameAt(scene, holdStart(k) + 100);
      m.cells.forEach((c, i) => {
        if (i === hl.cell) expect(c.dim).toBe(0);
        else expect(c.dim).toBeGreaterThan(0);
      });
    });
  });

  it("gives every highlight the same hold and the same scale", () => {
    const widths = scene.highlights.map((_, k) => {
      const mid = sheetFrameAt(scene, holdStart(k) + scene.t.holdMs / 2).camera.s;
      const end = sheetFrameAt(scene, holdStart(k) + scene.t.holdMs - 1).camera.s;
      return [mid, end];
    });
    for (const w of widths) {
      expect(w[0]).toBeCloseTo(widths[0]![0]!, 9);
      expect(w[1]).toBeCloseTo(widths[0]![1]!, 9);
    }
    // And whatever the ids or the order of the cells.
    const other = buildSheetScene({
      ...makeInput(25, idx),
      cells: cellsOf(25).map((c, i) => ({ ...c, id: `z${24 - i}` })),
      highlights: idx.map((i) => `z${24 - i}`).reverse(),
    });
    expect(other.t.holdMs).toBe(scene.t.holdMs);
    expect(other.holdScale).toBe(scene.holdScale);
  });
});

describe("order of highlights", () => {
  it("visits highlights in takenAt order whatever the listing order", () => {
    const input = makeInput(25, [20, 3, 11]);
    const scene = buildSheetScene(input);
    const visited = scene.highlights.map((h) => scene.cells[h.cell]!.takenAt);
    expect(visited).toEqual([...visited].sort((a, b) => a - b));
    expect(scene.highlights.map((h) => scene.cells[h.cell]!.id)).toEqual(["c3", "c11", "c20"]);
  });
});

describe("title", () => {
  it("prints just the time when all photos share a day", () => {
    const scene = buildSheetScene(makeInput(25, spread(4, 25)));
    const hl = scene.highlights;
    for (const h of hl) expect(scene.texts[h.time]!.text).toMatch(/^\d{2}:\d{2}$/);
    expect(scene.texts[hl[0]!.time]!.text).toBe("20:00");
  });

  it("prefixes the day when photos span more than one day", () => {
    const input = makeInput(25, spread(4, 25));
    input.cells = cellsOf(25, { dayOf: (i) => (i < 12 ? 1 : 2) });
    const scene = buildSheetScene(input);
    for (const h of scene.highlights) expect(scene.texts[h.time]!.text).toMatch(/^Día \d+ · \d{2}:\d{2}$/);
    const last = scene.highlights[scene.highlights.length - 1]!;
    expect(scene.texts[last.time]!.text).toBe("Día 2 · " + scene.texts[last.time]!.text.slice(-5));
  });

  it("shows no time at the midpoint of a move between two highlights", () => {
    const scene = buildSheetScene(makeInput(25, spread(4, 25)));
    const slot = scene.t.moveMs + scene.t.holdMs;
    const t = scene.t.developEnd + slot + scene.t.moveMs / 2;
    const items = sheetFrameAt(scene, t).title.items;
    for (const it of items) expect(it.opacity).toBe(0);
  });
});

describe("end card", () => {
  const scene = buildSheetScene(makeInput(25, spread(4, 25)));
  it("fades in over 400 ms from the end of the closing", () => {
    expect(sheetFrameAt(scene, scene.t.doneAt).endCard.opacity).toBe(0);
    expect(sheetFrameAt(scene, scene.t.doneAt + 400).endCard.opacity).toBe(1);
  });
});
