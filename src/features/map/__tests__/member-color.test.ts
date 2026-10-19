import { MEMBER_COLORS, memberColor } from "../member-color";

describe("memberColor", () => {
  it("always returns the same color for the same person", () => {
    const id = "6f1c2c3e-9d1a-4b7e-8a52-0c1f3d4e5a6b";
    expect(memberColor(id)).toBe(memberColor(id));
  });

  it("always comes from the fixed palette, in hex", () => {
    for (let i = 0; i < 200; i++) {
      const color = memberColor(`member-${i}`);
      expect(MEMBER_COLORS).toContain(color);
      expect(color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("spreads different people across different colors", () => {
    const colors = new Set(Array.from({ length: 50 }, (_, i) => memberColor(`member-${i}`)));
    expect(colors.size).toBeGreaterThan(5);
  });
});
