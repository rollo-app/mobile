const OPTIONS = { uri: "file:///cache/film.mp4", width: 1080, height: 1920, fps: 30, bitrate: 6_000_000 };

function native() {
  return {
    open: jest.fn(),
    append: jest.fn(),
    appendTexture: jest.fn(),
    finish: jest.fn(),
    cancel: jest.fn(),
    shareToInstagram: jest.fn(),
  };
}

/** Loads the wrapper with the native module present or not (it is resolved once, at load). */
function load(module: ReturnType<typeof native> | null) {
  let wrapper!: typeof import("..");
  jest.isolateModules(() => {
    jest.doMock("expo", () => {
      const actual = jest.requireActual("expo");
      return {
        ...actual,
        requireOptionalNativeModule: (name: string) => (name === "RolloVideo" ? module : actual.requireOptionalNativeModule(name)),
      };
    });
    wrapper = require("..");
  });
  return wrapper;
}

afterEach(() => jest.dontMock("expo"));

describe("RolloVideo wrapper", () => {
  it("is available only when the build has the native module", () => {
    expect(load(native()).videoAvailable).toBe(true);
    expect(load(null).videoAvailable).toBe(false);
  });
  it("passes the options through on open", () => {
    const fake = native();
    load(fake).openVideo(OPTIONS);
    expect(fake.open).toHaveBeenCalledWith(OPTIONS);
  });
  it("hands the frame bytes and the row size to append", () => {
    const fake = native();
    const pixels = new Uint8Array(8);
    load(fake).appendFrame(pixels, 4320);
    expect(fake.append).toHaveBeenCalledWith(pixels, 4320);
  });
  it("sends a texture pointer as a decimal string", () => {
    const fake = native();
    load(fake).appendTexture(4302123456n);
    expect(fake.appendTexture).toHaveBeenCalledWith("4302123456");
  });
  it("resolves finish with the native file", async () => {
    const fake = native();
    fake.finish.mockResolvedValue({ uri: OPTIONS.uri, bytes: 28280042, frames: 1226 });
    await expect(load(fake).finishVideo()).resolves.toEqual({ uri: OPTIONS.uri, bytes: 28280042, frames: 1226 });
  });
  it("asks the native module to open Instagram with the target, the file and the app id", async () => {
    const fake = native();
    fake.shareToInstagram.mockResolvedValue(true);
    await expect(load(fake).shareVideoToInstagram("reels", OPTIONS.uri, "123")).resolves.toBe(true);
    expect(fake.shareToInstagram).toHaveBeenCalledWith({ target: "reels", videoUri: OPTIONS.uri, appId: "123" });
  });
  it("without the module: writing fails with a clear error, cancel does nothing, Instagram resolves false", async () => {
    const wrapper = load(null);
    expect(() => wrapper.openVideo(OPTIONS)).toThrow("RolloVideo is not in this build");
    expect(() => wrapper.appendFrame(new Uint8Array(4), 4)).toThrow("RolloVideo is not in this build");
    expect(() => wrapper.appendTexture(1n)).toThrow("RolloVideo is not in this build");
    await expect(wrapper.finishVideo()).rejects.toThrow("RolloVideo is not in this build");
    expect(() => wrapper.cancelVideo()).not.toThrow();
    await expect(wrapper.shareVideoToInstagram("stories", OPTIONS.uri, "123")).resolves.toBe(false);
  });
});
