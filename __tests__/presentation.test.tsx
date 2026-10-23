import { act } from "@testing-library/react-native";
import { router } from "expo-router";
import { Text } from "react-native";
import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import * as likeActions from "@/features/likes/actions";
import * as actions from "@/features/trips/actions";
import { PHOTO_MS } from "@/features/presentation/story";
import { markPresentationSeen } from "@/storage/presentation";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/likes/actions");
jest.mock("expo-haptics", () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: "light" } }));
jest.mock("expo-video", () => ({
  useVideoPlayer: () => ({ play: jest.fn(), pause: jest.fn(), muted: true, loop: false }),
  VideoView: () => null,
}));
const mocked = jest.mocked(actions);
const likes = jest.mocked(likeActions);

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

const press = async (x = 600) => fireEvent.press(await screen.findByTestId("story-surface"), { nativeEvent: { locationX: x } });
/** A single tap: on a photo it waits out the double-tap window before it moves. */
const tap = async (x = 600) => {
  await press(x);
  await act(async () => jest.advanceTimersByTime(300));
};

beforeEach(async () => {
  likes.likeMedia.mockReset().mockResolvedValue(undefined);
  likes.unlikeMedia.mockReset().mockResolvedValue(undefined);
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
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur", { role: "admin" })] });
});

describe("Presentation", () => {
  it("starts at the first day card (no reveal intro), then walks photos and the outro", async () => {
    await renderRouter(routes, { initialUrl: "/presentation" });

    await screen.findByText("Día 1");
    expect(screen.queryByText("Se reveló")).toBeNull();
    expect(screen.getByText("12 de enero")).toBeTruthy();

    await tap();
    await screen.findByText("el viento no perdona");
    expect(screen.getByLabelText(/Foto de Fede, \d\d:\d\d\. el viento no perdona/)).toBeTruthy();

    await tap(); // b
    await tap(); // day 2
    await screen.findByText("Día 2");
    await tap(); // c
    await tap(); // outro
    await screen.findByText("Así fue");
    expect(screen.getByLabelText("3 fotos")).toBeTruthy();
    expect(screen.getByLabelText("2 personas")).toBeTruthy();
    expect(screen.getByLabelText("2 días")).toBeTruthy();
    expect(screen.getByText("Fede sacó más fotos: 2 fotos")).toBeTruthy();
  });

  it("tapping the left side goes back to the previous photo", async () => {
    await renderRouter(routes, { initialUrl: "/presentation" });
    await tap();
    await screen.findByText("el viento no perdona");
    await tap(); // b
    await tap(10);
    await screen.findByText("el viento no perdona");
  });

  it("tapping the author leaves the presentation and opens their profile, without advancing the story", async () => {
    await renderRouter({ ...routes, "user/[id]": () => <Text>Perfil de alguien</Text> }, { initialUrl: "/roll" });
    await act(async () => router.push("/presentation"));
    await tap();
    await screen.findByText("el viento no perdona");

    await fireEvent.press(screen.getByRole("button", { name: "Perfil de Fede" }));

    await waitFor(() => expect(screen).toHavePathname("/user/u-m2"));
    expect(await screen.findByText("Perfil de alguien")).toBeVisible();
    expect(screen.queryByTestId("story-surface")).toBeNull();
  });

  it("'Ver de nuevo' restarts the story", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });
    await act(async () => router.push("/presentation"));
    for (let i = 0; i < 6; i++) await tap();
    await fireEvent.press(await screen.findByLabelText("Ver de nuevo"));
    await screen.findByText("Día 1");
  });

  it("has no visible close button and closes with the VoiceOver escape action", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });
    await act(async () => router.push("/presentation"));
    await screen.findByText("Día 1");
    expect(screen.queryByLabelText("Cerrar")).toBeNull();

    await fireEvent(await screen.findByTestId("story-surface"), "accessibilityAction", { nativeEvent: { actionName: "escape" } });
    await waitFor(() => expect(screen).toHavePathname("/roll"));
  });

  it("closes from the hidden 'Cerrar presentación' button", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });
    await act(async () => router.push("/presentation"));
    await fireEvent.press(await screen.findByLabelText("Cerrar presentación"));
    await waitFor(() => expect(screen).toHavePathname("/roll"));
  });

  it("never shows the reveal intro, even when it was never seen", async () => {
    await renderRouter(routes, { initialUrl: "/presentation" });
    await screen.findByText("Día 1");
    expect(screen.queryByText("Se reveló")).toBeNull();
    expect(screen.queryByText(/Revelando/)).toBeNull();
  });

  it("explains when there are no photos to show", async () => {
    mocked.fetchFeed.mockResolvedValue({ revealed: true, revealAt: 0, items: [] });
    await renderRouter(routes, { initialUrl: "/presentation" });
    await screen.findByText("Todavía no hay fotos para mostrar.");
  });
});

describe("Presentation: likes", () => {
  it("a photo story shows an outline heart, with no counter and no burst", async () => {
    await renderRouter(routes, { initialUrl: "/presentation" });
    await tap();
    await screen.findByText("el viento no perdona");

    const heart = screen.getByRole("button", { name: "Me gusta" });
    expect(within(heart).getByTestId("story-heart").props.name).toBe("heart");
    expect(within(heart).queryByText(/\d/)).toBeNull();
    expect(screen.queryByTestId("heart-burst")).toBeNull();
  });

  it("double tap on a photo likes it, fills the heart and stays on it", async () => {
    await renderRouter(routes, { initialUrl: "/presentation" });
    await tap();
    await screen.findByText("el viento no perdona");

    await press();
    await press();

    await waitFor(() => expect(likes.likeMedia).toHaveBeenCalledWith("a"));
    const heart = await screen.findByRole("button", { name: "Ya no me gusta" });
    expect(within(heart).getByTestId("story-heart").props.name).toBe("heart.fill");
    expect(screen.queryByTestId("heart-burst")).toBeNull();
    await act(async () => jest.advanceTimersByTime(300));
    expect(screen.getByText("el viento no perdona")).toBeVisible();
  });

  it("tapping the heart likes the photo and tapping it again takes the like away, without moving", async () => {
    await renderRouter(routes, { initialUrl: "/presentation" });
    await tap();
    await screen.findByText("el viento no perdona");

    await fireEvent.press(screen.getByRole("button", { name: "Me gusta" }));
    await waitFor(() => expect(likes.likeMedia).toHaveBeenCalledWith("a"));
    await fireEvent.press(await screen.findByRole("button", { name: "Ya no me gusta" }));
    await waitFor(() => expect(likes.unlikeMedia).toHaveBeenCalledWith("a"));
    expect(await screen.findByRole("button", { name: "Me gusta" })).toBeTruthy();
    expect(screen.getByText("el viento no perdona")).toBeVisible();
  });

  it("double tap on a photo you already like doesn't take it away", async () => {
    const liked = await mocked.fetchFeed("x");
    mocked.fetchFeed.mockResolvedValue({ ...liked, items: liked.items.map((i) => ({ ...i, likedByMe: true, likeCount: 1 })) });
    await renderRouter(routes, { initialUrl: "/presentation" });
    await tap();
    await screen.findByText("el viento no perdona");

    await press();
    await press();
    await act(async () => jest.advanceTimersByTime(300));

    expect(likes.unlikeMedia).not.toHaveBeenCalled();
    expect(likes.likeMedia).not.toHaveBeenCalled();
    expect(screen.getByText("el viento no perdona")).toBeVisible();
  });

  it("a second double tap after liking doesn't send it again", async () => {
    await renderRouter(routes, { initialUrl: "/presentation" });
    await tap();
    await screen.findByText("el viento no perdona");

    await press();
    await press();
    await waitFor(() => expect(likes.likeMedia).toHaveBeenCalledTimes(1));
    await act(async () => jest.advanceTimersByTime(300));
    await press();
    await press();
    await act(async () => jest.advanceTimersByTime(300));

    expect(likes.likeMedia).toHaveBeenCalledTimes(1);
    expect(likes.unlikeMedia).not.toHaveBeenCalled();
  });

  it("on a video, taps move right away and never like", async () => {
    const base = await mocked.fetchFeed("x");
    mocked.fetchFeed.mockResolvedValue({
      ...base,
      items: [{ ...base.items[0]!, type: "video", durationS: 10, caption: "un video" }, ...base.items.slice(1)],
    });
    await renderRouter(routes, { initialUrl: "/presentation" });
    await tap();
    await screen.findByText("un video");
    expect(screen.queryByRole("button", { name: "Me gusta" })).toBeNull();

    await press();
    await press();

    expect(likes.likeMedia).not.toHaveBeenCalled();
    // Two immediate moves: past the video and the next photo, to day 2.
    await screen.findByText("Día 2");
  });

  it("a tap right before the photo moves on by itself doesn't also skip the next one", async () => {
    await renderRouter(routes, { initialUrl: "/presentation" });
    await tap();
    await screen.findByText("el viento no perdona");

    // `tap()` already let 300 ms of this photo run: tap ~100 ms before it moves on by itself.
    await act(async () => jest.advanceTimersByTime(PHOTO_MS - 400));
    await press();
    await act(async () => jest.advanceTimersByTime(200));
    await act(async () => jest.advanceTimersByTime(300));

    // Exactly one step forward: the next photo (b), not day 2.
    expect(screen.getByLabelText(/^Foto de Juani/)).toBeTruthy();
    expect(screen.queryByText("Día 2")).toBeNull();
  });
});
