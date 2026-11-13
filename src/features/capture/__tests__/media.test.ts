import { prepareMedia } from "../media";
import { embedMetadata } from "@/features/exif/embed";

jest.mock("@/features/exif/embed", () => ({ embedMetadata: jest.fn(async () => {}) }));
jest.mock("expo-image", () => ({ Image: { generateThumbhashAsync: jest.fn(async () => "thumbhash") } }));

/** Fake mockDisk: uri -> pixel size and byte size. */
const mockDisk = new Map<string, { w: number; h: number; bytes: number }>();
const mockRenders: Array<{ from: string; resize: unknown; compress: number }> = [];
let mockOutN = 0;

jest.mock("expo-file-system", () => {
  class File {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = parts.map((p, i) => (typeof p === "string" ? p : p.uri) + "").join("/").replace(/\/+/g, "/").replace("file:/", "file:///");
      if (parts.length === 1 && typeof parts[0] === "string") this.uri = parts[0];
    }
    get exists() {
      return mockDisk.has(this.uri);
    }
    get size() {
      return mockDisk.get(this.uri)?.bytes ?? 0;
    }
    async move(dest: File) {
      mockDisk.set(dest.uri, mockDisk.get(this.uri)!);
      mockDisk.delete(this.uri);
    }
    copy(dest: File) {
      mockDisk.set(dest.uri, { ...mockDisk.get(this.uri)! });
    }
    delete() {
      mockDisk.delete(this.uri);
    }
  }
  class Directory {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/");
    }
    create() {}
  }
  return { File, Directory, Paths: { document: { uri: "file:///docs" } } };
});

jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  ImageManipulator: {
    manipulate: (from: string) => {
      let resize: { width?: number; height?: number } | undefined;
      return {
        resize: (r: { width?: number; height?: number }) => {
          resize = r;
        },
        renderAsync: async () => ({
          saveAsync: async ({ compress }: { compress: number }) => {
            const src = mockDisk.get(from)!;
            const scale = resize ? (resize.width ? resize.width / src.w : resize.height! / src.h) : 1;
            const w = Math.round(src.w * scale);
            const h = Math.round(src.h * scale);
            const uri = `file:///tmp/out-${++mockOutN}.jpg`;
            mockDisk.set(uri, { w, h, bytes: Math.round(w * h * compress * 0.2) });
            mockRenders.push({ from, resize, compress });
            return { uri, width: w, height: h };
          },
        }),
      };
    },
  },
}));

const META = { takenAt: Date.UTC(2027, 0, 5, 15), timeZone: "America/Argentina/Buenos_Aires", location: null, caption: "hola", author: "Juani" };
const photo = { uri: "file:///cache/p.jpg", width: 4000, height: 3000 };

beforeEach(() => {
  mockDisk.clear();
  mockRenders.length = 0;
  jest.mocked(embedMetadata).mockClear();
  mockDisk.set(photo.uri, { w: 4000, h: 3000, bytes: 9_000_000 });
});

describe("prepareMedia display version", () => {
  it("writes original, thumb and a display of at most 2048 px next to them", async () => {
    const out = await prepareMedia(photo, "abc", META);

    expect(out.originalUri).toBe("file:///docs/pending/abc/original.jpg");
    expect(out.displayUri).toBe("file:///docs/pending/abc/display.jpg");
    const display = mockDisk.get(out.displayUri!)!;
    expect(Math.max(display.w, display.h)).toBe(2048);
    expect(out.displaySizeBytes).toBe(display.bytes);
    expect(out.displaySizeBytes).toBeLessThan(4 * 1024 * 1024);
    expect(mockDisk.get(out.thumbUri)).toBeDefined();
  });

  it("encodes the display as JPEG ~0.82 from the full original", async () => {
    await prepareMedia(photo, "abc", META);

    const display = mockRenders.find((r) => (r.resize as { width?: number })?.width === 2048);
    expect(display).toMatchObject({ from: "file:///docs/pending/abc/original.jpg", compress: 0.82 });
  });

  it("embeds the same metadata in the original and in the display, not in the thumb", async () => {
    await prepareMedia(photo, "abc", META);

    const calls = jest.mocked(embedMetadata).mock.calls.map(([file, meta]) => [file.uri, meta]);
    expect(calls).toEqual([
      ["file:///docs/pending/abc/original.jpg", META],
      ["file:///docs/pending/abc/display.jpg", META],
    ]);
  });

  it("a front-camera photo that is already small gets a display that is not resized further, and it is still uploaded", async () => {
    mockDisk.set(photo.uri, { w: 1080, h: 810, bytes: 400_000 });
    const out = await prepareMedia({ ...photo, width: 1080, height: 810 }, "abc", META, { maxDimension: 1080 });

    expect(out.displayUri).toBe("file:///docs/pending/abc/display.jpg");
    expect(mockDisk.get(out.displayUri!)).toMatchObject({ w: 1080, h: 810 });
    expect(out.displaySizeBytes).toBe(out.sizeBytes);
    // No third render: original and thumb only.
    expect(mockRenders).toHaveLength(2);
  });
});
