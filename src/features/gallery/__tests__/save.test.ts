import { Album, Asset, requestPermissionsAsync } from "expo-media-library";
import { File } from "expo-file-system";
import { embedMetadataIfMissing } from "@/features/exif/embed";
import type { RevealedPhoto } from "@/features/media/revealed";
import {
  PermissionDeniedError,
  albumTitle,
  createSaver,
  downloadAll,
  withLinkedImages,
  requestAlbumAccess,
  estimateBytes,
  formatMegabytes,
} from "../save";

jest.mock("@/features/exif/embed", () => ({ embedMetadataIfMissing: jest.fn(async () => true) }));

const photo = (id: string, type: "photo" | "video" = "photo"): RevealedPhoto => ({
  id,
  type,
  takenAt: 0,
  day: "2027-01-12",
  lat: null,
  lng: null,
  caption: null,
  durationS: null,
  width: null,
  height: null,
  thumbhash: null,
  author: { id: "m1", userId: "u-m1", name: "Cami", username: null, avatarUrl: null },
  thumbPath: `/trips/t/media/${id}/thumb`,
  originalPath: `/trips/t/media/${id}/original`,
  authorUserId: "u-m1",
  featuredByMe: false,
  featureBlocked: false,
  likeCount: 0,
  canFeature: true,
  likedByMe: false,
  commentCount: 0,
  momentDay: null,
  selfie: null,
});

const ctx = {
  token: "tok",
  albumName: "Rollo · Sur",
  baseUrl: "https://api.test",
  timeZone: "America/Argentina/Buenos_Aires",
};

beforeEach(() => {
  jest.clearAllMocks();
  (requestPermissionsAsync as jest.Mock).mockResolvedValue({
    granted: true,
    canAskAgain: true,
  });
  (Album.get as jest.Mock).mockResolvedValue(null);
});

describe("album title and estimate", () => {
  it("names the album after the roll", () => {
    expect(albumTitle("Sur 2027")).toBe("Rollo · Sur 2027");
  });

  it("estimates size with a bigger share for videos", () => {
    expect(estimateBytes([photo("a"), photo("b", "video")])).toBeGreaterThan(estimateBytes([photo("a"), photo("b")]));
    expect(formatMegabytes(640 * 1024 * 1024)).toBe("640 MB");
    expect(formatMegabytes(1.5 * 1024 * 1024 * 1024)).toBe("1,5 GB");
  });
});

describe("createSaver", () => {
  it("saves one by one without touching the album (add-only permission is enough)", async () => {
    const save = createSaver(ctx);
    await save(photo("a"));
    expect(requestPermissionsAsync).toHaveBeenCalledWith(true);
    expect(Asset.create).toHaveBeenCalledWith(expect.any(String));
    expect(Album.get).not.toHaveBeenCalled();
    expect(Album.create).not.toHaveBeenCalled();
    expect((File as any).deleted).toBe(1);
  });

  it("fills in missing metadata from the feed data before adding a photo to Photos", async () => {
    const order: string[] = [];
    (embedMetadataIfMissing as jest.Mock).mockImplementationOnce(async () => void order.push("embed"));
    (Asset.create as jest.Mock).mockImplementationOnce(async () => void order.push("create"));
    const withData = { ...photo("a"), takenAt: 1_800_000_000_000, lat: -50.3, lng: -72.2, caption: "Viento", author: { id: "m1", userId: "u-m1", name: "Cami", username: null, avatarUrl: null } };
    await createSaver(ctx)(withData);
    expect(embedMetadataIfMissing).toHaveBeenCalledWith(expect.anything(), {
      takenAt: 1_800_000_000_000,
      timeZone: "America/Argentina/Buenos_Aires",
      location: { lat: -50.3, lng: -72.2, accuracyM: null },
      caption: "Viento",
      author: "Cami",
    });
    expect(order).toEqual(["embed", "create"]);
  });

  it("passes no location when the photo has none", async () => {
    await createSaver(ctx)(photo("a"));
    expect(embedMetadataIfMissing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ location: null }));
  });

  it("leaves videos untouched", async () => {
    await createSaver(ctx)(photo("v", "video"));
    expect(embedMetadataIfMissing).not.toHaveBeenCalled();
    expect(Asset.create).toHaveBeenCalledTimes(1);
  });

  it("downloads the original with the bearer token and creates the album the first time", async () => {
    const save = createSaver(ctx);
    await save(photo("a"), { album: true });
    expect(File.downloadFileAsync).toHaveBeenCalledWith(
      "https://api.test/trips/t/media/a/original",
      expect.anything(),
      { headers: { Authorization: "Bearer tok" } },
    );
    expect(requestPermissionsAsync).toHaveBeenCalledWith(true);
    expect(Album.create).toHaveBeenCalledWith("Rollo · Sur", [expect.anything()]);
  });

  it("adds to the existing album and removes the temp file", async () => {
    const album = { id: "al" };
    (Album.get as jest.Mock).mockResolvedValue(album);
    const save = createSaver(ctx);
    await save(photo("a"), { album: true });
    await save(photo("b"), { album: true });
    expect(Album.create).not.toHaveBeenCalled();
    expect(Asset.create).toHaveBeenCalledTimes(2);
    expect(Asset.create).toHaveBeenCalledWith(expect.any(String), album);
    expect((File as any).deleted).toBe(2);
  });

  it("creates the album only once for parallel saves", async () => {
    const save = createSaver(ctx);
    await Promise.all([
      save(photo("a"), { album: true }),
      save(photo("b"), { album: true }),
      save(photo("c"), { album: true }),
    ]);
    expect(Album.create).toHaveBeenCalledTimes(1);
    expect(Asset.create).toHaveBeenCalledTimes(3);
  });

  it("throws PermissionDeniedError when the user said no", async () => {
    (requestPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    await expect(createSaver(ctx)(photo("a"), { album: true })).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(File.downloadFileAsync).not.toHaveBeenCalled();
  });

  it("removes the temp file even if saving fails", async () => {
    (Album.get as jest.Mock).mockResolvedValue({ id: "al" });
    (Asset.create as jest.Mock).mockRejectedValueOnce(new Error("disk"));
    await expect(createSaver(ctx)(photo("a"), { album: true })).rejects.toThrow("disk");
    expect((File as any).deleted).toBe(1);
  });
});

describe("requestAlbumAccess", () => {
  it("asks for full access and is true only when iOS grants all of it", async () => {
    (requestPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      accessPrivileges: "all",
    });
    expect(await requestAlbumAccess()).toBe(true);
    expect(requestPermissionsAsync).toHaveBeenCalledWith(false);
  });

  it("is false with limited access or when denied", async () => {
    (requestPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      accessPrivileges: "limited",
    });
    expect(await requestAlbumAccess()).toBe(false);
    (requestPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      canAskAgain: false,
      accessPrivileges: "none",
    });
    expect(await requestAlbumAccess()).toBe(false);
  });
});

describe("downloadAll", () => {
  const photos = Array.from({ length: 10 }, (_, i) => photo(`p${i}`));

  it("never runs more than 3 at a time and reports progress", async () => {
    let running = 0;
    let peak = 0;
    const save = jest.fn(async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 1));
      running--;
    });
    const progress: number[] = [];
    const result = await downloadAll(photos, save, {
      onProgress: (done) => progress.push(done),
    });
    expect(peak).toBe(3);
    expect(result).toEqual({ saved: 10, failed: [], cancelled: false });
    expect(progress[progress.length - 1]).toBe(10);
  });

  it("retries a failure once and counts the ones that still fail", async () => {
    const attempts: Record<string, number> = {};
    const save = jest.fn(async (p: RevealedPhoto) => {
      attempts[p.id] = (attempts[p.id] ?? 0) + 1;
      if (p.id === "p1" && attempts[p.id]! < 2) throw new Error("flaky");
      if (p.id === "p2") throw new Error("always");
    });
    const result = await downloadAll(photos.slice(0, 4), save, {});
    expect(attempts.p1).toBe(2);
    expect(attempts.p2).toBe(2);
    expect(result.saved).toBe(3);
    expect(result.failed.map((p) => p.id)).toEqual(["p2"]);
  });

  it("stops picking new photos once cancelled", async () => {
    const controller = new AbortController();
    const save = jest.fn(async () => {
      if (save.mock.calls.length === 3) controller.abort();
    });
    const result = await downloadAll(photos, save, {
      signal: controller.signal,
    });
    expect(result.cancelled).toBe(true);
    expect(save.mock.calls.length).toBeLessThan(10);
    expect(result.saved).toBe(save.mock.calls.length);
  });

  it("aborts the whole run on a denied permission without retrying", async () => {
    const save = jest.fn(async () => {
      throw new PermissionDeniedError(false);
    });
    await expect(downloadAll(photos, save, {})).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(save.mock.calls.length).toBeLessThanOrEqual(3);
  });
});

describe("withLinkedImages", () => {
  it("adds the linked image of a moment after its main photo, with the same author and time", () => {
    const main: RevealedPhoto = {
      ...photo("main"),
      momentDay: "2027-01-12",
      takenAt: 5,
      selfie: { id: "linked", thumbPath: "/t/linked/thumb", originalPath: "/t/linked/original", thumbhash: null, width: 1080, height: 1440 },
    };
    const [a, b, c] = withLinkedImages([photo("x"), main]);
    expect(a!.id).toBe("x");
    expect(b!.id).toBe("main");
    expect(c).toMatchObject({ id: "linked", type: "photo", originalPath: "/t/linked/original", takenAt: 5, caption: null, author: main.author, selfie: null });
  });

  it("returns ordinary photos untouched", () => {
    const list = [photo("x"), photo("y", "video")];
    expect(withLinkedImages(list)).toEqual(list);
  });
});
