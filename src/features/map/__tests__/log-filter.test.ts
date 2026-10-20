import { isTileNetworkNoise } from "../log-filter";

const log = (over: Partial<{ level: string; tag: string; message: string }>) => ({
  level: "error",
  tag: "Mbgl-HttpRequest",
  message: "Request failed due to a permanent error: The Internet connection appears to be offline.",
  ...over,
});

describe("isTileNetworkNoise", () => {
  it("silences network requests that fail with no signal", () => {
    expect(isTileNetworkNoise(log({}))).toBe(true);
  });

  it("silences tiles that could not be loaded", () => {
    expect(isTileNetworkNoise(log({ tag: "Mbgl-Tile", message: "Failed to load tile 12/1234/2345: offline" }))).toBe(true);
  });

  const requestFailed = (url: string, code: number, text: string) =>
    `[-[MLNNetworkConfiguration errorLog:]] Requesting: ${url} failed with error: Error Domain=NSURLErrorDomain Code=${code} "${text}"`;

  it("silences the Spanish iOS message, whatever the tag", () => {
    const message = requestFailed("https://tiles.openfreemap.org/planet/20260101/4/5/9.pbf", -1009, "La conexión a internet parece estar desactivada.");
    expect(isTileNetworkNoise(log({ tag: "Mbgl", message }))).toBe(true);
  });

  it("silences the English message and tile, glyph and sprite URLs", () => {
    for (const url of ["https://t.test/4/5/9.pbf", "https://t.test/fonts/Noto/0-255.pbf", "https://t.test/sprites/sprite@2x.png"]) {
      const message = requestFailed(url, -1009, "The Internet connection appears to be offline.");
      expect(isTileNetworkNoise(log({ tag: "Mbgl", message }))).toBe(true);
    }
  });

  it("silences every connectivity code", () => {
    for (const code of [-1009, -1001, -1004, -1005, -1020, -1018]) {
      expect(isTileNetworkNoise(log({ tag: "Mbgl", message: requestFailed("https://t.test/1/1/1.pbf", code, "x") }))).toBe(true);
    }
  });

  it("lets other failed requests through", () => {
    expect(isTileNetworkNoise(log({ tag: "Mbgl", message: requestFailed("https://t.test/1/1/1.pbf", -1100, "file does not exist") }))).toBe(false);
  });

  it("lets the rest of the errors through", () => {
    expect(isTileNetworkNoise(log({ tag: "Mbgl-Style", message: "Invalid layer 'foo'" }))).toBe(false);
    expect(isTileNetworkNoise(log({ tag: "Mbgl-Map", message: "Failed to compile shader" }))).toBe(false);
  });
});
