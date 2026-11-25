// The card that goes over the background (Instagram's sticker, or the still image's middle): pure layout math, no Skia.

/** Width of the card, in story pixels (the story is 1080 wide). */
export const CARD_W = 920;
/** Inner padding on every side. */
export const CARD_PAD = 48;
/** Corner radius of the card. */
export const CARD_RADIUS = 56;
/** Width of what's inside the padding: the mosaic and the invite's square hero. */
export const CARD_CONTENT_W = CARD_W - CARD_PAD * 2;

/** One 34 px line (the caption, "Sumate con el código"): its laid-out height. */
export const SMALL_LINE_H = 41;
/** Collage: between the caption and the title. */
export const TITLE_GAP = 8;
/** Collage: between the end of the title (1 to 3 lines) and the mosaic. */
export const MOSAIC_GAP = 40;
/** Collage: the mosaic is the fixed 6×4 grid at 3:2 over the content width. */
export const MOSAIC_H = (CARD_CONTENT_W * 2) / 3;

/** Invite: "Sumate con el código" starts this far below the hero. */
export const CODE_LABEL_GAP = 48;
/** Invite: between the label and the code. */
export const CODE_GAP = 8;
/** Invite: the 110 px code's laid-out height. */
export const CODE_H = 132;

/** Above the brand (from the mosaic or the code). */
export const BRAND_GAP = 40;
/** The brand: the logo row (44) + its gap (10) + the site line (~30). */
export const BRAND_H = 84;

/** The card's total height from its parts. The invite's title is inside its hero, so `titleHeight` only matters for the collage. */
export function cardHeight(input: { kind: "collage" | "invite"; titleHeight: number }): number {
  const body =
    input.kind === "collage"
      ? SMALL_LINE_H + TITLE_GAP + input.titleHeight + MOSAIC_GAP + MOSAIC_H
      : CARD_CONTENT_W + CODE_LABEL_GAP + SMALL_LINE_H + CODE_GAP + CODE_H;
  return Math.ceil(CARD_PAD + body + BRAND_GAP + BRAND_H + CARD_PAD);
}

/** A rendered card: PNG bytes (transparent outside the rounded rect) and its size in pixels. */
export type Card = { png: Uint8Array; width: number; height: number };
