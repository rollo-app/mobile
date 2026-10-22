import { act } from "@testing-library/react-native";
import { router } from "expo-router";
import { Text } from "react-native";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as actions from "@/features/trips/actions";
import { markPresentationSeen } from "@/storage/presentation";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
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
  },
  me: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin" },
  members: [
    { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin" },
    { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null, role: "member" },
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

const tap = async () => fireEvent.press(await screen.findByTestId("story-surface"), { nativeEvent: { locationX: 600 } });

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
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur", { role: "admin" })] });
});

describe("Presentation", () => {
  it("opens with the reveal title, then walks day card, photos and the outro", async () => {
    await renderRouter(routes, { initialUrl: "/presentation" });

    await screen.findByText("Se reveló");
    expect(screen.getByText("Viaje al sur")).toBeTruthy();

    await tap();
    await screen.findByText("Día 1");
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
    await tap();
    await screen.findByText("el viento no perdona");
    await tap(); // b
    await fireEvent.press(await screen.findByTestId("story-surface"), { nativeEvent: { locationX: 10 } });
    await screen.findByText("el viento no perdona");
  });

  it("tapping the author leaves the presentation and opens their profile, without advancing the story", async () => {
    await renderRouter({ ...routes, "user/[id]": () => <Text>Perfil de alguien</Text> }, { initialUrl: "/roll" });
    await act(async () => router.push("/presentation"));
    await tap();
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
    for (let i = 0; i < 7; i++) await tap();
    await fireEvent.press(await screen.findByLabelText("Ver de nuevo"));
    await screen.findByText("Se reveló");

  });

  it("has no visible close button and closes with the VoiceOver escape action", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });
    await act(async () => router.push("/presentation"));
    await screen.findByText("Se reveló");
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

  it("explains when there are no photos to show", async () => {
    mocked.fetchFeed.mockResolvedValue({ revealed: true, revealAt: 0, items: [] });
    await renderRouter(routes, { initialUrl: "/presentation" });
    await screen.findByText("Todavía no hay fotos para mostrar.");
  });
});
