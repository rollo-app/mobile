import {
  DEFAULT_STYLE,
  STORY_STYLES,
  STYLE_ASSETS,
  STYLE_LABEL,
  STYLE_PALETTE,
  styleFromLabel,
} from "../story-style";

describe("story-style", () => {
  it("has the two styles, dark first and by default", () => {
    expect(STORY_STYLES).toEqual(["dark", "light"]);
    expect(DEFAULT_STYLE).toBe("dark");
    expect(STORY_STYLES.map((s) => STYLE_LABEL[s])).toEqual(["Oscuro", "Claro"]);
  });

  it("maps a label back to its style, unknown ones to the default", () => {
    expect(styleFromLabel("Oscuro")).toBe("dark");
    expect(styleFromLabel("Claro")).toBe("light");
    expect(styleFromLabel("x")).toBe("dark");
  });

  it("has the exact palette", () => {
    expect(STYLE_PALETTE.dark).toEqual({ card: "#141416", text: "#ffffff", base: "#0b0b0c" });
    expect(STYLE_PALETTE.light).toEqual({ card: "#fbfaf7", text: "#111111", base: "#f3efe8" });
  });

  it("resolves the video and still of each style", () => {
    for (const s of STORY_STYLES) {
      expect(STYLE_ASSETS[s].video).toBeDefined();
      expect(STYLE_ASSETS[s].still).toBeDefined();
    }
  });
});
