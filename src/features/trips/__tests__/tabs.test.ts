import { tabsFor } from "../tabs";

const none = { left: null, ...{} };

describe("tabsFor", () => {
  it("while shooting: camera opens capture and shows the photos left today", () => {
    const tabs = tabsFor("active", { photos: 7, videos: 2 });
    expect(tabs.roll).toEqual({ sf: { default: "film", selected: "film.fill" }, md: "movie", label: "Rollo" });
    expect(tabs.camera).toMatchObject({ sf: "camera.fill", label: "Cámara", target: "/capture", badge: "7" });
    expect(tabs.feedHidden).toBe(false);
  });

  it("with the quota used up or before the start, the camera is locked", () => {
    expect(tabsFor("active", { photos: 0, videos: 0 }).camera).toMatchObject({ sf: "lock.fill", label: "Cámara, sin fotos por hoy", badge: null });
    expect(tabsFor("upcoming", none.left).camera).toMatchObject({ sf: "lock.fill", label: "Cámara, rollo cerrado", badge: null });
    expect(tabsFor("ended", { photos: 3, videos: 1 }).camera).toMatchObject({ label: "Cámara, rollo cerrado", badge: null });
  });

  it("after the reveal: gallery, presentation without badge, and no feed", () => {
    const tabs = tabsFor("revealed", { photos: 3, videos: 1 });
    expect(tabs.roll).toMatchObject({ sf: { default: "square.grid.2x2", selected: "square.grid.2x2.fill" }, label: "Galería" });
    expect(tabs.camera).toEqual({ sf: "play.rectangle.fill", md: "slideshow", label: "Presentación", target: "/presentation", badge: null });
    expect(tabs.feedHidden).toBe(true);
  });

  it("while the phase is unknown it looks like shooting", () => {
    expect(tabsFor(null, null).camera).toMatchObject({ target: "/capture", sf: "camera.fill" });
  });
});
