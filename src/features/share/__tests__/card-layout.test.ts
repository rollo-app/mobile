import { CARD_PAD, CARD_RADIUS, CARD_W, cardHeight } from "../card-layout";

describe("cardHeight", () => {
  it("collage grows by exactly the title's extra height", () => {
    const one = cardHeight({ kind: "collage", titleHeight: 84 });
    const three = cardHeight({ kind: "collage", titleHeight: 252 });
    expect(three - one).toBe(168);
  });

  it("invite does not depend on the title, which goes inside the hero", () => {
    expect(cardHeight({ kind: "invite", titleHeight: 84 })).toBe(cardHeight({ kind: "invite", titleHeight: 252 }));
  });

  it("invite covers the square hero plus both paddings", () => {
    expect(cardHeight({ kind: "invite", titleHeight: 84 })).toBeGreaterThan(CARD_W);
  });

  it.each([84, 168, 252])("both fit in the story with margin (title %i)", (titleHeight) => {
    expect(cardHeight({ kind: "collage", titleHeight })).toBeLessThanOrEqual(1700);
    expect(cardHeight({ kind: "invite", titleHeight })).toBeLessThanOrEqual(1700);
  });

  it("uses the card constants", () => {
    expect([CARD_W, CARD_PAD, CARD_RADIUS]).toEqual([920, 48, 56]);
  });
});
