import { describeOfflineMap, type OfflineMapState } from "../offline-status";

const state = (over: Partial<OfflineMapState> = {}): OfflineMapState => ({
  zones: 0,
  bytes: 0,
  incomplete: 0,
  running: false,
  percent: null,
  waitingForWifi: false,
  ...over,
});

describe("describeOfflineMap", () => {
  it("shows the progress while downloading", () => {
    expect(describeOfflineMap(state({ running: true, percent: 44.6 }))).toBe("Bajando… 45 %");
    expect(describeOfflineMap(state({ running: true }))).toBe("Bajando…");
  });

  it("shows zones and size when everything is downloaded", () => {
    expect(describeOfflineMap(state({ zones: 3, bytes: 28 * 1024 * 1024 }))).toBe("Listo · 3 zonas · 28 MB");
    expect(describeOfflineMap(state({ zones: 1, bytes: 1000 }))).toBe("Listo · 1 zona · 1 MB");
  });

  it("says it waits for Wi-Fi", () => {
    expect(describeOfflineMap(state({ waitingForWifi: true }))).toBe("Se baja con Wi‑Fi");
  });

  it("says it is not needed yet when there is nothing to do", () => {
    expect(describeOfflineMap(state())).toBe("No hace falta todavía");
  });

  it("says when a download is unfinished", () => {
    expect(describeOfflineMap(state({ zones: 2, incomplete: 1 }))).toBe("Se completa cuando haya conexión");
  });
});
