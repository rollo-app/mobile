import type { VideoFile, VideoOptions } from "../../../../modules/rollo-video";
import { exportFilm, frameCount, MAX_RESTARTS, type ExportInput } from "../export-film";

const VIDEO: VideoOptions = { uri: "file:///cache/film.mp4", width: 1080, height: 1920, fps: 30, bitrate: 8_000_000 };

function setup(overrides: Partial<ExportInput> = {}, frameMs = 15) {
  const calls: string[] = [];
  const written: [number, number][] = [];
  let clock = 0;
  const input: ExportInput = {
    video: VIDEO,
    durationMs: 1000,
    writeFrame: (index, timeMs) => {
      written.push([index, timeMs]);
      clock += frameMs;
    },
    sink: {
      open: () => void calls.push("open"),
      finish: async (): Promise<VideoFile> => {
        calls.push("finish");
        return { uri: "file:///cache/film.mp4", bytes: 123, frames: written.length };
      },
      cancel: () => void calls.push("cancel"),
    },
    isActive: () => true,
    untilActive: async () => void calls.push("untilActive"),
    pause: async () => void calls.push("pause"),
    now: () => clock,
    isCancelled: () => false,
    ...overrides,
  };
  return { input, calls, written };
}

describe("export-film", () => {
  it("counts frames by rounding", () => {
    expect(frameCount(1000, 30)).toBe(30);
    expect(frameCount(40866.67, 30)).toBe(1226);
    expect(frameCount(1, 30)).toBe(1);
    for (const [d, f] of [[0, 30], [NaN, 30], [1000, 0], [-5, 30], [Infinity, 30]]) expect(() => frameCount(d!, f!)).toThrow(RangeError);
  });

  it("writes every frame once, in order, at i × 1000 / fps", async () => {
    const { input, calls, written } = setup();
    const file = await exportFilm(input);
    expect(written).toHaveLength(30);
    expect(written[0]).toEqual([0, 0]);
    expect(written[29]).toEqual([29, (29 * 1000) / 30]);
    expect(calls[0]).toBe("open");
    expect(calls.at(-1)).toBe("finish");
    expect(file).toEqual({ uri: "file:///cache/film.mp4", bytes: 123, frames: 30 });
  });

  it("gives the UI a turn every SLICE_MS of work, but not after the last frame", async () => {
    const { input, calls } = setup(); // 15 ms per frame: a slice is 3 frames
    await exportFilm(input);
    expect(calls.filter((c) => c === "pause")).toHaveLength(9);
  });

  it("reports progress after each slice and once at the end", async () => {
    const onProgress = jest.fn();
    await exportFilm(setup({ onProgress }).input);
    expect(onProgress.mock.calls[0]).toEqual([3, 30]);
    expect(onProgress.mock.calls.at(-1)).toEqual([30, 30]);
    expect(onProgress).toHaveBeenCalledTimes(10);
  });

  it("stops and removes the file when cancelled", async () => {
    let pauses = 0;
    const { input, calls, written } = setup({ isCancelled: () => pauses > 0 });
    input.pause = async () => void (pauses += 1);
    await expect(exportFilm(input)).resolves.toBeNull();
    expect(written).toHaveLength(3);
    expect(calls).toContain("cancel");
    expect(calls).not.toContain("finish");
  });

  it("waits in the background instead of drawing", async () => {
    let active = true;
    const { input, calls, written } = setup();
    input.pause = async () => void (active = written.length !== 3); // goes to the background after the first slice
    input.isActive = () => active;
    input.untilActive = async () => {
      calls.push(`untilActive at ${written.length}`);
      active = true;
    };
    await exportFilm(input);
    expect(calls).toContain("untilActive at 3");
    expect(written).toHaveLength(30);
  });

  it("starts over when the encoder dies after a background wait", async () => {
    let active = true;
    let broken = false;
    const { input, calls, written } = setup();
    const write = input.writeFrame;
    input.pause = async () => void (active = written.length !== 3);
    input.isActive = () => active;
    input.untilActive = async () => {
      active = true;
      broken = true;
    };
    input.writeFrame = (i, t) => {
      if (broken) {
        broken = false;
        throw new Error("the encoder stopped");
      }
      write(i, t);
    };
    const file = await exportFilm(input);
    expect(calls.filter((c) => c === "open")).toHaveLength(2);
    expect(calls.filter((c) => c === "cancel")).toHaveLength(1);
    expect(written.slice(0, 4).map(([i]) => i)).toEqual([0, 1, 2, 0]);
    expect(file?.frames).toBe(33); // 3 before the restart + the 30 of the film
  });

  it("an encoder error with no background wait is an error", async () => {
    const { input, calls } = setup({
      writeFrame: (i) => {
        if (i === 5) throw new Error("the encoder stopped");
      },
    });
    await expect(exportFilm(input)).rejects.toThrow("the encoder stopped");
    expect(calls.filter((c) => c === "open")).toHaveLength(1);
    expect(calls).toContain("cancel");
  });

  it("gives up after MAX_RESTARTS restarts", async () => {
    let active = false;
    const { input, calls } = setup({
      writeFrame: () => {
        throw new Error("the encoder stopped");
      },
    });
    input.isActive = () => active;
    input.untilActive = async () => void (active = true);
    const open = input.sink.open;
    input.sink.open = (o) => {
      active = false;
      open(o);
    }; // every run starts in the background
    await expect(exportFilm(input)).rejects.toThrow("the encoder stopped");
    expect(calls.filter((c) => c === "open")).toHaveLength(MAX_RESTARTS + 1);
  });

  it("a failing open or finish leaves nothing behind", async () => {
    const a = setup();
    a.input.sink.open = () => {
      throw new Error("cannot write");
    };
    await expect(exportFilm(a.input)).rejects.toThrow("cannot write");
    expect(a.calls).toContain("cancel");
    const b = setup();
    b.input.sink.finish = async () => {
      throw new Error("could not finish");
    };
    await expect(exportFilm(b.input)).rejects.toThrow("could not finish");
    expect(b.calls).toContain("cancel");
  });
});
