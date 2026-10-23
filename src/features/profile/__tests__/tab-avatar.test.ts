import { renderTabAvatar } from "../tab-avatar";

const SIZE = 40;

function solid(r: number, g: number, b: number, size = SIZE) {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) data.set([r, g, b, 255], i * 4);
  return data;
}

function px(data: Uint8Array, x: number, y: number, size = SIZE) {
  const i = (y * size + x) * 4;
  return { r: data[i] ?? 0, g: data[i + 1] ?? 0, b: data[i + 2] ?? 0, a: data[i + 3] ?? 0 };
}

const ring = { color: [49, 85, 245] as [number, number, number], width: 3, gap: 2 };

describe("renderTabAvatar (plain)", () => {
  const out = renderTabAvatar(solid(200, 10, 20), SIZE);

  it("keeps the size of the buffer", () => {
    expect(out.length).toBe(SIZE * SIZE * 4);
  });

  it("makes the corners transparent", () => {
    expect(px(out, 0, 0).a).toBe(0);
    expect(px(out, SIZE - 1, 0).a).toBe(0);
    expect(px(out, 0, SIZE - 1).a).toBe(0);
  });

  it("keeps the center opaque with the original color", () => {
    expect(px(out, 20, 20)).toEqual({ r: 200, g: 10, b: 20, a: 255 });
  });

  it("antialiases the edge with partial alpha", () => {
    const alphas = Array.from({ length: SIZE }, (_, x) => px(out, x, 20).a);
    expect(alphas.some((a) => a > 0 && a < 255)).toBe(true);
  });
});

describe("renderTabAvatar (selected ring)", () => {
  const out = renderTabAvatar(solid(200, 10, 20), SIZE, { ring });

  it("draws the ring color near the outer edge", () => {
    // y = 20, x = 1 or 2 is inside the ring (outer radius 20, width 3).
    expect(px(out, 1, 20)).toEqual({ r: 49, g: 85, b: 245, a: 255 });
  });

  it("leaves a transparent gap between ring and photo", () => {
    // ring covers radius 17..20, gap 15..17, photo up to 15 → x = 4 (radius 16) is the gap.
    expect(px(out, 4, 20).a).toBe(0);
  });

  it("keeps the photo color at the center", () => {
    expect(px(out, 20, 20)).toEqual({ r: 200, g: 10, b: 20, a: 255 });
  });

  it("makes the corners transparent", () => {
    expect(px(out, 0, 0).a).toBe(0);
  });

  it("antialiases the outer edge of the ring", () => {
    const alphas = Array.from({ length: 5 }, (_, x) => px(out, x, 20).a);
    expect(alphas.some((a) => a > 0 && a < 255)).toBe(true);
  });

  it("keeps the shrunken photo opaque up to just inside the gap", () => {
    expect(px(out, 6, 20)).toEqual({ r: 200, g: 10, b: 20, a: 255 });
  });
});
