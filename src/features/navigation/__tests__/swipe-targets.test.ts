import {
  EDGE_GUARD,
  isHorizontalDrag,
  resolveSwipe,
  swipeHref,
  swipeTabs,
  swipeTarget,
} from "../swipe-targets";

describe("swipeTabs", () => {
  it("lists Rollo, Feed and Perfil in bar order, skipping Mapa and Cámara", () => {
    expect(swipeTabs({ feedHidden: false })).toEqual(["roll", "feed", "me"]);
  });

  it("drops Feed once it is hidden after the reveal", () => {
    expect(swipeTabs({ feedHidden: true })).toEqual(["roll", "me"]);
  });
});

describe("swipeTarget", () => {
  const visible = ["roll", "feed", "me"] as const;

  it("goes to the tab on the left when dragging left to right", () => {
    expect(swipeTarget(visible, "me", "previous")).toBe("feed");
    expect(swipeTarget(visible, "feed", "previous")).toBe("roll");
  });

  it("goes to the next tab when dragging right to left", () => {
    expect(swipeTarget(visible, "roll", "next")).toBe("feed");
    expect(swipeTarget(visible, "feed", "next")).toBe("me");
  });

  it("does nothing at the ends", () => {
    expect(swipeTarget(visible, "roll", "previous")).toBeNull();
    expect(swipeTarget(visible, "me", "next")).toBeNull();
  });

  it("skips the hidden Feed", () => {
    expect(swipeTarget(["roll", "me"], "me", "previous")).toBe("roll");
    expect(swipeTarget(["roll", "me"], "roll", "next")).toBe("me");
  });

  it("does nothing when the current tab is not visible", () => {
    expect(swipeTarget(["roll", "me"], "feed", "next")).toBeNull();
  });
});

describe("swipeHref", () => {
  it("maps each tab to its route", () => {
    expect(swipeHref("roll")).toBe("/roll");
    expect(swipeHref("feed")).toBe("/feed");
    expect(swipeHref("me")).toBe("/me");
  });
});

describe("isHorizontalDrag", () => {
  it("claims a clearly horizontal drag that starts away from the edge", () => {
    expect(isHorizontalDrag({ dx: 20, dy: 5, startX: 200 })).toBe(true);
    expect(isHorizontalDrag({ dx: -20, dy: 5, startX: 200 })).toBe(true);
  });

  it("ignores tiny moves and mostly vertical drags", () => {
    expect(isHorizontalDrag({ dx: 4, dy: 0, startX: 200 })).toBe(false);
    expect(isHorizontalDrag({ dx: 20, dy: 20, startX: 200 })).toBe(false);
    expect(isHorizontalDrag({ dx: 20, dy: 14, startX: 200 })).toBe(false);
  });

  it("ignores drags that start in the left edge (iOS back swipe)", () => {
    expect(isHorizontalDrag({ dx: 30, dy: 0, startX: EDGE_GUARD - 1 })).toBe(false);
    expect(isHorizontalDrag({ dx: 30, dy: 0, startX: EDGE_GUARD })).toBe(true);
  });
});

describe("resolveSwipe", () => {
  it("left to right past the threshold means previous", () => {
    expect(resolveSwipe({ dx: 80, dy: 10, vx: 0.1 })).toBe("previous");
  });

  it("right to left past the threshold means next", () => {
    expect(resolveSwipe({ dx: -80, dy: 10, vx: -0.1 })).toBe("next");
  });

  it("needs enough distance, unless it was a fast flick", () => {
    expect(resolveSwipe({ dx: 40, dy: 0, vx: 0.1 })).toBeNull();
    expect(resolveSwipe({ dx: 40, dy: 0, vx: 0.8 })).toBe("previous");
    expect(resolveSwipe({ dx: -40, dy: 0, vx: -0.8 })).toBe("next");
    expect(resolveSwipe({ dx: 10, dy: 0, vx: 2 })).toBeNull();
  });

  it("is not a swipe when the drag is too diagonal", () => {
    expect(resolveSwipe({ dx: 80, dy: 60, vx: 1 })).toBeNull();
  });
});
