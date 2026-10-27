import { act } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { router } from "expo-router";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as actions from "@/features/trips/actions";
import { markPresentationSeen } from "@/storage/presentation";
import { hasSeenRevealIntro, markRevealIntroSeen } from "@/storage/reveal-intro";
import { signInAs, tripSummary } from "@/test/account";
import { REVEAL_TIMELINE } from "@/features/reveal/timeline";
import { routes } from "@/test/routes";
import { queryClient } from "@/api/query-client";
import { feedKey } from "@/features/trips/use-feed";

jest.mock("@/features/trips/actions");
// A short intro, so the hand-over to the stories happens within the test's wait.
jest.mock("@/features/reveal/timeline", () => ({ REVEAL_TIMELINE: { ...jest.requireActual("@/features/reveal/timeline").REVEAL_TIMELINE, totalMs: 600 } }));
jest.mock("expo-haptics", () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: "light" } }));
jest.mock("expo-video", () => ({
  useVideoPlayer: () => ({ play: jest.fn(), pause: jest.fn(), muted: true, loop: false }),
  VideoView: () => null,
}));
const mocked = jest.mocked(actions);

const SUR = "11111111-1111-4111-8111-111111111111";
const TZ = "America/Argentina/Buenos_Aires";

const detail = (): actions.TripDetail => ({
  trip: {
    id: SUR,
    name: "Viaje al sur",
    joinCode: "HUB5FT",
    timezone: TZ,
    startsAt: Date.parse("2027-01-11T12:00:00Z"),
    endsAt: Date.parse("2027-01-14T12:00:00Z"),
    revealAt: Date.parse("2027-01-14T12:00:00Z"),
    revealed: true,
    dailyPhotoLimit: 10,
    dailyVideoLimit: 3,
    featuringDisabled: false,
    photoLimitMode: "daily",
    totalPhotoLimit: null,
    momentMode: "off",
    momentWindowStart: 540,
    momentWindowEnd: 1380,
  },
  me: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin", blockedByMe: false },
  members: [
    { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin", blockedByMe: false },
    { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null, role: "member", blockedByMe: false },
  ],
  today: { date: "2027-01-14", photosLeft: 0, videosLeft: 0 },
  totalUploaded: 3,
});

const item = (id: string, iso: string, author: { id: string; name: string; username?: string | null; avatarUrl: string | null }, caption: string | null): actions.Feed["items"][number] => ({
  id,
  type: "photo",
  takenAt: Date.parse(iso),
  day: iso.slice(0, 10),
  lat: null,
  lng: null,
  caption,
  durationS: null,
  thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
  author: { username: null, userId: `u-${author.id}`, ...author },
  files: { thumb: `/m/${id}/thumb`, original: `/m/${id}/original` },
});

beforeEach(async () => {
  mocked.fetchTrip.mockResolvedValue(detail());
  mocked.fetchFeed.mockResolvedValue({
    revealed: true,
    revealAt: Date.parse("2027-01-14T12:00:00Z"),
    items: [
      item("a", "2027-01-12T15:00:00Z", { id: "m2", name: "Fede", avatarUrl: null }, "el viento no perdona"),
      item("b", "2027-01-12T16:00:00Z", { id: "m1", name: "Juani", avatarUrl: null }, null),
      item("c", "2027-01-13T15:00:00Z", { id: "m2", name: "Fede", avatarUrl: null }, null),
    ],
  });
  await markPresentationSeen(SUR); // the first-open presentation would cover these screens
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur", { role: "admin", revealed: true })] });
});

describe("Reveal", () => {
  it("plays the reveal intro and then continues with the stories", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });
    await act(async () => router.push("/reveal"));
    await screen.findByText("Se reveló");
    expect(screen.queryByTestId("story-surface")).toBeNull();

    await waitFor(() => expect(screen).toHavePathname("/presentation"));
    await screen.findByText("Día 1");
  });

  it("tapping anywhere skips to the stories", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });
    await act(async () => router.push("/reveal"));
    await screen.findByText("Se reveló");

    await fireEvent.press(screen.getByTestId("reveal-surface"));

    expect(screen).toHavePathname("/presentation"); // right away, without waiting for the intro to end
    await screen.findByText("Día 1");
  });

  it("remembers the intro as seen as soon as it starts", async () => {
    expect(await hasSeenRevealIntro(SUR)).toBe(false);
    await renderRouter(routes, { initialUrl: "/reveal" });
    await screen.findByText("Se reveló");
    await act(async () => {});
    expect(await hasSeenRevealIntro(SUR)).toBe(true);
  });

  describe("while it loads", () => {
    const hangingFeed = () => mocked.fetchFeed.mockReturnValue(new Promise(() => {}));

    it("shows a spinner and a tap goes on to the stories", async () => {
      hangingFeed();
      await renderRouter(routes, { initialUrl: "/roll" });
      await act(async () => router.push("/reveal"));

      await fireEvent.press(await screen.findByTestId("reveal-loading"));

      expect(screen).toHavePathname("/presentation");
    });

    // renderRouter already runs on Jest's fake timers.
    it("goes on to the stories when it takes too long", async () => {
      hangingFeed();
      await renderRouter(routes, { initialUrl: "/roll" });
      await act(async () => router.push("/reveal"));
      expect(screen.getByTestId("reveal-loading")).toBeTruthy();
      await act(async () => jest.advanceTimersByTime(REVEAL_TIMELINE.loadingTimeoutMs - 100));
      expect(screen).toHavePathname("/reveal");

      await act(async () => jest.advanceTimersByTime(100));
      expect(screen).toHavePathname("/presentation");
    });

    it("clears the safety timer when it leaves", async () => {
      hangingFeed();
      await renderRouter(routes, { initialUrl: "/roll" });
      await act(async () => router.push("/reveal"));
      expect(screen.getByTestId("reveal-loading")).toBeTruthy();
      const replace = jest.spyOn(router, "replace");

      screen.unmount();
      jest.advanceTimersByTime(REVEAL_TIMELINE.loadingTimeoutMs * 2); // nothing is mounted: no act

      expect(replace).not.toHaveBeenCalled();
      replace.mockRestore();
    });
  });

  // Opened right at the reveal, the cached feed is still the one from before it (no files yet).
  it("plays with the fresh feed instead of skipping to the stories with the cached one", async () => {
    queryClient.setQueryData(
      feedKey(SUR),
      { revealed: false, revealAt: Date.parse("2027-01-14T12:00:00Z"), items: [{ ...item("a", "2027-01-12T15:00:00Z", { id: "m2", name: "Fede", avatarUrl: null }, null), files: null }] },
      { updatedAt: Date.now() },
    );
    await renderRouter(routes, { initialUrl: "/roll" });
    await act(async () => router.push("/reveal"));

    await screen.findByText("Se reveló");
    expect(screen).toHavePathname("/reveal");
  });

  it("with only moments cached from before the reveal, waits for the refetch instead of playing with just them", async () => {
    queryClient.setQueryData(
      feedKey(SUR),
      { revealed: false, revealAt: Date.parse("2027-01-14T12:00:00Z"), items: [{ ...item("a", "2027-01-12T15:00:00Z", { id: "m2", name: "Fede", avatarUrl: null }, null), momentDay: "2027-01-12" }] },
      { updatedAt: Date.now() },
    );
    const full = await mocked.fetchFeed(SUR);
    let resolve!: (f: actions.Feed) => void;
    mocked.fetchFeed.mockReturnValue(new Promise((r) => (resolve = r)));
    await renderRouter(routes, { initialUrl: "/roll" });
    await act(async () => router.push("/reveal"));

    expect(await screen.findByTestId("reveal-loading")).toBeVisible();
    expect(screen.queryByText("Se reveló")).toBeNull();
    await act(async () => resolve(full));
    await screen.findByText("Se reveló");
  });

  it("gives the skip surface a button role and label", async () => {
    await renderRouter(routes, { initialUrl: "/reveal" });
    await screen.findByText("Se reveló");
    expect(screen.getByRole("button", { name: "Saltar el revelado" })).toBe(screen.getByTestId("reveal-surface"));
  });

  describe("thumbs", () => {
    const realFetch = globalThis.fetch;
    afterEach(() => {
      globalThis.fetch = realFetch;
    });

    it("waits for the thumbs before it starts, up to the cap", async () => {
      globalThis.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
      await renderRouter(routes, { initialUrl: "/roll" });
      await act(async () => router.push("/reveal"));
      await screen.findByTestId("reveal-loading");

      await act(async () => jest.advanceTimersByTime(REVEAL_TIMELINE.thumbsCapMs - 100));
      expect(screen.queryByText("Se reveló")).toBeNull();

      await act(async () => jest.advanceTimersByTime(200));
      expect(screen.getByText("Se reveló")).toBeTruthy();
    });
  });

  describe("with Reduce Motion", () => {
    // Not restoreAllMocks: it wipes React Native's own jest.fn, and later tests would wait forever for the flag.
    afterEach(() => jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false));

    it("hands over to the stories after the short reduced sequence, not the full one", async () => {
      jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
      await renderRouter(routes, { initialUrl: "/roll" });
      await act(async () => router.push("/reveal"));
      await screen.findByText("Se reveló");
      const { totalMs } = REVEAL_TIMELINE.reduced;

      await act(async () => jest.advanceTimersByTime(totalMs - 100));
      expect(screen).toHavePathname("/reveal");
      await act(async () => jest.advanceTimersByTime(100));
      expect(screen).toHavePathname("/presentation");
    });

    it("does not start until Reduce Motion is known", async () => {
      jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockReturnValue(new Promise(() => {}));
      await renderRouter(routes, { initialUrl: "/roll" });
      await act(async () => router.push("/reveal"));
      await act(async () => jest.advanceTimersByTime(REVEAL_TIMELINE.thumbsCapMs + 100));

      expect(screen.queryByText("Se reveló")).toBeNull();
      expect(screen.getByTestId("reveal-loading")).toBeTruthy();
    });
  });

  it("plays even when it was already seen", async () => {
    await markRevealIntroSeen(SUR);
    await renderRouter(routes, { initialUrl: "/reveal" });
    await screen.findByText("Se reveló");
  });
});
