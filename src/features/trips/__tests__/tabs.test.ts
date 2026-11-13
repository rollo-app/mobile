import { tabsFor } from "../tabs";

const none = { left: null, ...{} };

describe("tabsFor", () => {
  it("while shooting: camera opens capture and shows the photos left today", () => {
    const tabs = tabsFor("active", { photos: 7 });
    expect(tabs.roll).toEqual({ sf: { default: "film", selected: "film.fill" }, md: "movie", label: "Rollo" });
    expect(tabs.camera).toMatchObject({ sf: "camera.fill", label: "Cámara", target: "/capture", badge: "7" });
    expect(tabs).not.toHaveProperty("feedHidden");
  });

  it("with the quota used up or before the start, the camera is locked", () => {
    expect(tabsFor("active", { photos: 0 }).camera).toMatchObject({ sf: "lock.fill", label: "Cámara, sin fotos", badge: null });
    expect(tabsFor("upcoming", none.left).camera).toMatchObject({ sf: "lock.fill", label: "Cámara, rollo cerrado", badge: null });
    expect(tabsFor("ended", { photos: 3 }).camera).toMatchObject({ label: "Cámara, rollo cerrado", badge: null });
  });

  it("after the reveal: gallery and presentation without badge", () => {
    const tabs = tabsFor("revealed", { photos: 3 });
    expect(tabs.roll).toMatchObject({ sf: { default: "square.grid.2x2", selected: "square.grid.2x2.fill" }, label: "Galería" });
    expect(tabs.camera).toEqual({ sf: "play.rectangle.fill", md: "slideshow", label: "Presentación", target: "/presentation", badge: null });
    expect(tabs).not.toHaveProperty("feedHidden");
  });

  it("while the phase is unknown it looks like shooting", () => {
    expect(tabsFor(null, null).camera).toMatchObject({ target: "/capture", sf: "camera.fill" });
  });
});

describe("tabsFor without a roll", () => {
  it("shows the camera locked and sends its tap to the Rollo tab", () => {
    const tabs = tabsFor(null, null, false);
    expect(tabs.camera.target).toBe("/roll");
    expect(tabs.camera.badge).toBeNull();
    expect(tabs.camera.sf).toBe("lock.fill");
    expect(tabs.camera.label).toBe("Cámara, primero hace falta un rollo");
  });

  it("changes nothing when there is a roll", () => {
    expect(tabsFor(null, null, true)).toEqual(tabsFor(null, null));
  });
});

describe("tabsFor map tab", () => {
  const MAPA = { sf: { default: "map", selected: "map.fill" }, md: "map", label: "Mapa", hidden: false };

  it("trips keep Mapa", () => {
    expect(tabsFor("active", { photos: 7 }).map).toEqual(MAPA);
    expect(tabsFor("revealed", null, true, false).map).toEqual(MAPA);
    expect(tabsFor(null, null, false).map).toEqual(MAPA);
  });

  it("event tabs show Feed before reveal and hide it after", () => {
    for (const phase of ["upcoming", "active", "ended", null] as const) {
      expect(tabsFor(phase, { photos: 3 }, true, true).map).toEqual({
        sf: { default: "list.bullet.rectangle", selected: "list.bullet.rectangle.fill" },
        md: "list",
        label: "Feed",
        hidden: false,
      });
    }
    expect(tabsFor("revealed", null, true, true).map.hidden).toBe(true);
  });

  it("an event leaves the other tabs as in a trip", () => {
    const { map: _a, ...event } = tabsFor("active", { photos: 7 }, true, true);
    const { map: _b, ...trip } = tabsFor("active", { photos: 7 });
    expect(event).toEqual(trip);
  });
});
