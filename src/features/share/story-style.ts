/** The two looks of the Stories piece: each has a background video, a still frame and card colors. */
export type StoryStyle = "dark" | "light";

export const DEFAULT_STYLE: StoryStyle = "dark";
export const STORY_STYLES: readonly StoryStyle[] = ["dark", "light"];

export const STYLE_LABEL: Record<StoryStyle, string> = { dark: "Oscuro", light: "Claro" };

/** `brand` is the logo's cobalt (as in the app icon, lighter on dark). `base` is the background's solid color: the fallback while (or if) the video doesn't load. */
export type StylePalette = { card: string; text: string; base: string; brand: string };

export const STYLE_PALETTE: Record<StoryStyle, StylePalette> = {
  dark: { card: "#141416", text: "#ffffff", base: "#0b0b0c", brand: "#5C7CFF" },
  light: { card: "#fbfaf7", text: "#111111", base: "#f3efe8", brand: "#3155F5" },
};

export const STYLE_ASSETS: Record<StoryStyle, { video: number; still: number }> = {
  dark: {
    video: require("../../../assets/stories/bg-dark.mp4"),
    still: require("../../../assets/stories/bg-dark.jpg"),
  },
  light: {
    video: require("../../../assets/stories/bg-light.mp4"),
    still: require("../../../assets/stories/bg-light.jpg"),
  },
};

/** Inverse of `STYLE_LABEL`; anything unknown gives `DEFAULT_STYLE`. */
export const styleFromLabel = (label: string): StoryStyle =>
  STORY_STYLES.find((s) => STYLE_LABEL[s] === label) ?? DEFAULT_STYLE;
