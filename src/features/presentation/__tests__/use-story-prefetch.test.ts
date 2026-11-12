import { renderHook } from "@testing-library/react-native";
import { Image } from "expo-image";
import type { RevealedPhoto } from "@/features/media/revealed";
import { buildStory, type StoryStep } from "../story";
import { useStoryPrefetch } from "../use-story-prefetch";

jest.mock("expo-image", () => ({
  Image: { clearMemoryCache: jest.fn(() => Promise.resolve(true)), prefetch: jest.fn(() => Promise.resolve(true)) },
}));

const photoStep = (id: string, type: "photo" | "video" = "photo"): StoryStep =>
  ({ kind: "photo", photo: { id, type, thumbPath: `/t/${id}`, originalPath: `/o/${id}` } as RevealedPhoto }) as StoryStep;
const dayStep = { kind: "day" } as StoryStep;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => jest.clearAllMocks());

describe("useStoryPrefetch", () => {
  it("prefetches the next three photos at the start (thumbs, plus originals for photos only)", async () => {
    const steps = [dayStep, photoStep("1"), photoStep("2", "video"), photoStep("3"), photoStep("4")];
    await renderHook(() => useStoryPrefetch(steps, 0, "tok"));
    await flush();
    const urls = jest.mocked(Image.prefetch).mock.calls[0]![0] as string[];
    expect(urls).toHaveLength(5);
    expect(urls.some((u) => u.endsWith("/o/2"))).toBe(false);
    expect(jest.mocked(Image.prefetch).mock.calls[0]![1]).toEqual({ headers: { Authorization: "Bearer tok" } });
    expect(Image.clearMemoryCache).toHaveBeenCalledTimes(1);
  });

  it("only clears the memory cache on day cards", async () => {
    const steps = [dayStep, photoStep("1"), photoStep("2"), photoStep("3")];
    await renderHook(() => useStoryPrefetch(steps, 1, "tok"));
    await flush();
    expect(Image.clearMemoryCache).not.toHaveBeenCalled();
    expect(Image.prefetch).toHaveBeenCalledTimes(1);
  });

  it("only prefetches photos that made the selection", async () => {
    const big = Array.from({ length: 100 }, (_, i) => ({
      id: `p${i}`, type: "photo", takenAt: Date.parse("2027-01-12T15:00:00Z") + i * 60_000, likeCount: 0,
      author: { id: "m1" }, thumbPath: `/t/p${i}`, originalPath: `/o/p${i}`,
    })) as unknown as RevealedPhoto[];
    const steps = buildStory(big, "America/Argentina/Buenos_Aires");
    const selected = new Set(steps.flatMap((s) => (s.kind === "photo" ? [s.photo.id] : [])));
    expect(selected.size).toBe(30);
    await renderHook(() => useStoryPrefetch(steps, 0, "tok"));
    await flush();
    const urls = jest.mocked(Image.prefetch).mock.calls[0]![0] as string[];
    for (const u of urls) expect(selected.has(u.split("/").at(-1)!)).toBe(true);
  });
});
