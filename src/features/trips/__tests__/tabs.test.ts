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
