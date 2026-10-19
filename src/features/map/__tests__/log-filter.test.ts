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

  it("lets the rest of the errors through", () => {
    expect(isTileNetworkNoise(log({ tag: "Mbgl-Style", message: "Invalid layer 'foo'" }))).toBe(false);
    expect(isTileNetworkNoise(log({ tag: "Mbgl-Map", message: "Failed to compile shader" }))).toBe(false);
  });
});
