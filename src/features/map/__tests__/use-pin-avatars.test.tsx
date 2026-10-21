import { renderHook, waitFor } from "@testing-library/react-native";
import { usePinAvatars } from "../use-pin-avatars";
import { pinAvatarKey } from "../pin-avatars";
import type { MapItem } from "../features";
import { ensurePinAvatarFile } from "../pin-avatar-files";

jest.mock("../pin-avatar-files", () => ({ ensurePinAvatarFile: jest.fn() }));
jest.mock("@/config", () => ({ API_URL: "https://api.test" }));

const ensure = ensurePinAvatarFile as jest.Mock;

const item = (authorId: string, avatarUrl: string | null): MapItem => ({
  id: `m-${authorId}`,
  type: "photo",
  takenAt: 1,
  day: "2027-01-12",
  lat: 0,
  lng: 0,
  caption: null,
  durationS: null,
  thumbhash: null,
  authorId,
  authorName: "X",
  authorAvatarUrl: avatarUrl,
  pending: false,
});

beforeEach(() => ensure.mockReset());

describe("usePinAvatars", () => {
  it("generates one image per author with a photo and exposes it when ready", async () => {
    ensure.mockImplementation(async (_uri: string, key: string) => `file:///cache/${key}.png`);
    const items = [item("a1", "/avatars/a1.jpg"), item("a2", null)];
    const { result } = await renderHook(() => usePinAvatars(items));
    const key = pinAvatarKey("a1", "/avatars/a1.jpg");
    await waitFor(() => expect(result.current.ready.has(key)).toBe(true));
    expect(result.current.images).toEqual({ [key]: `file:///cache/${key}.png` });
    expect(ensure).toHaveBeenCalledTimes(1);
    expect(ensure).toHaveBeenCalledWith("https://api.test/avatars/a1.jpg", key);
  });

  it("generates sequentially, one at a time", async () => {
    let running = 0;
    let maxRunning = 0;
    ensure.mockImplementation(async (_u: string, key: string) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return `file:///${key}.png`;
    });
    const items = [item("a1", "/a1.jpg"), item("a2", "/a2.jpg"), item("a3", "/a3.jpg")];
    const { result } = await renderHook(() => usePinAvatars(items));
    await waitFor(() => expect(result.current.ready.size).toBe(3));
    expect(maxRunning).toBe(1);
  });

  it("silently skips a failing author and keeps going", async () => {
    ensure.mockImplementation(async (_u: string, key: string) => {
      if (key === pinAvatarKey("a1", "/a1.jpg")) throw new Error("offline");
      return `file:///${key}.png`;
    });
    const items = [item("a1", "/a1.jpg"), item("a2", "/a2.jpg")];
    const { result } = await renderHook(() => usePinAvatars(items));
    await waitFor(() => expect(result.current.ready.has(pinAvatarKey("a2", "/a2.jpg"))).toBe(true));
    expect(result.current.ready.has(pinAvatarKey("a1", "/a1.jpg"))).toBe(false);
  });

  it("does not regenerate what it already has when the items change", async () => {
    ensure.mockImplementation(async (_u: string, key: string) => `file:///${key}.png`);
    const first = [item("a1", "/a1.jpg")];
    const { result, rerender } = await renderHook(({ items }: { items: MapItem[] }) => usePinAvatars(items), { initialProps: { items: first } });
    await waitFor(() => expect(result.current.ready.size).toBe(1));
    await rerender({ items: [...first, item("a2", "/a2.jpg")] });
    await waitFor(() => expect(result.current.ready.size).toBe(2));
    expect(ensure).toHaveBeenCalledTimes(2);
  });
});
