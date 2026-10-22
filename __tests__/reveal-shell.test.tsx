import * as Notifications from "expo-notifications";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Text } from "react-native";
import * as profileActions from "@/features/profile/actions";
import * as actions from "@/features/trips/actions";
import { hasSeenPresentation, markPresentationSeen } from "@/storage/presentation";
import { getActiveTripId, setActiveTripId } from "@/storage/active-trip";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
const mocked = jest.mocked(actions);
const notifications = jest.mocked(Notifications);

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";

const detail = (over: Partial<actions.TripDetail["trip"]> = {}): actions.TripDetail => ({
  trip: {
    id: SUR,
    name: "Viaje al sur",
    joinCode: "HUB5FT",
    timezone: "America/Argentina/Buenos_Aires",
    startsAt: Date.now() - 5 * DAY,
    endsAt: Date.now() - 2 * DAY,
    revealAt: Date.now() - DAY,
    revealed: true,
    dailyPhotoLimit: 10,
    dailyVideoLimit: 3,
    ...over,
  },
  me: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin" },
  members: [{ id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin" }],
  today: { date: "2027-01-12", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 3,
});

const session = (active = SUR) =>
  signInAs({ trips: [tripSummary(SUR, "Viaje al sur"), tripSummary(OTRO, "Bariloche")], active });

const testRoutes = { ...routes, "photo/[id]": () => <Text>Foto</Text> };

afterEach(() => notifications.useLastNotificationResponse.mockReturnValue(null));

beforeEach(async () => {
  jest.clearAllMocks();
  mocked.fetchFeed.mockResolvedValue({ revealed: true, revealAt: Date.now() - DAY, items: [] });
  await session();
});

describe("revealed roll", () => {
  it("the header title follows the active trip when it switches to a revealed one", async () => {
    const upcoming = detail({ revealed: false, startsAt: Date.now() + DAY, endsAt: Date.now() + 2 * DAY, revealAt: Date.now() + 3 * DAY });
    mocked.fetchTrip.mockImplementation(async (id: string) =>
      id === SUR ? upcoming : detail({ id: OTRO, name: "Bariloche" }),
    );
    await markPresentationSeen(OTRO);
    await setActiveTripId(OTRO);
    await renderRouter(testRoutes, { initialUrl: "/roll" });
    // The Rollo tab's header comes first in the tree (the Mapa tab has its own title).
    const rollTitle = () => screen.getAllByLabelText(/, cambiar de rollo$/)[0]?.props.accessibilityLabel;
    // Open the revealed trip first so its detail is cached and the switch back to it is instant.
    await screen.findByText("Este rollo no tiene fotos");

    await act(async () => {
      await setActiveTripId(SUR);
    });
    await waitFor(() => expect(screen.queryByText("Fechas")).not.toBeNull());
    expect(rollTitle()).toBe("Viaje al sur, cambiar de rollo");

    await act(async () => {
      await setActiveTripId(OTRO);
    });

    await waitFor(() => expect(screen.queryByText("Este rollo no tiene fotos")).not.toBeNull());
    expect(rollTitle()).toBe("Bariloche, cambiar de rollo");
  });

  it("the Rollo tab shows the gallery instead of the board", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await markPresentationSeen(SUR);
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    expect(await screen.findByText("Este rollo no tiene fotos")).toBeVisible();
    expect(screen.queryByText("Fechas")).toBeNull();
  });

  it("the gallery has a 'Sobre el rollo' button that opens the invite and the members", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await markPresentationSeen(SUR);
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    await fireEvent.press(await screen.findByRole("button", { name: "Sobre el rollo" }));

    expect(screen).toHavePathname("/roll-info");
    expect(await screen.findByText("Invitar")).toBeVisible();
    expect(screen.getByText("HUB5FT")).toBeVisible();
    expect(screen.getByText("En el rollo · 1")).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Mapa sin señal/ })).toBeNull();
  });

  it("tapping a member in 'Sobre el rollo' closes the sheet and opens their profile", async () => {
    const fetchUser = jest.spyOn(profileActions, "fetchUser").mockResolvedValue({
      user: { id: "u-m2", name: "Fede", username: "fede", avatarUrl: null, bio: null },
      isFriend: false,
      profileVisibility: "friends",
      canSee: false,
      friendCount: 0,
      mutualCount: 0,
    });
    const base = detail();
    const fede = { id: "m2", userId: "u-m2", name: "Fede", username: "fede", avatarUrl: null, role: "member" as const };
    mocked.fetchTrip.mockResolvedValue({ ...base, members: [...base.members, fede] });
    await markPresentationSeen(SUR);
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    await fireEvent.press(await screen.findByRole("button", { name: "Sobre el rollo" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Fede" }));

    await waitFor(() => expect(screen).toHavePathname("/user/u-m2"));
    expect(await screen.findByText("Este perfil es privado")).toBeVisible();
    expect(screen.queryByText("En el rollo · 2")).toBeNull();
    fetchUser.mockRestore();
  });

  it("opens the presentation automatically the first time, and only once", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    mocked.fetchFeed.mockResolvedValue({
      revealed: true,
      revealAt: Date.now() - DAY,
      items: [
        {
          id: "a", type: "photo", takenAt: Date.now() - DAY, day: "2027-01-12", lat: null, lng: null, caption: null,
          thumbhash: null, durationS: null, author: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null },
          files: { thumb: "/m/a/thumb", original: "/m/a/original" },
        },
      ],
    });
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    expect(await screen.findByTestId("story-surface")).toBeTruthy();
    expect(screen).toHavePathname("/presentation");
    expect(await hasSeenPresentation(SUR)).toBe(true);
  });

  it("doesn't open it again once seen", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await markPresentationSeen(SUR);
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    await screen.findByText("Este rollo no tiene fotos");
    expect(screen).toHavePathname("/roll");
  });

  it("an ended roll that isn't revealed keeps the board and doesn't open the presentation", async () => {
    mocked.fetchTrip.mockResolvedValue(detail({ revealed: false, revealAt: Date.now() + DAY }));
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    expect(await screen.findByText("Fechas")).toBeVisible();
    expect(screen).toHavePathname("/roll");
  });
});

describe("reveal notification", () => {
  it("schedules a local notification for a roll that isn't revealed yet", async () => {
    const revealAt = Date.now() + 3 * DAY;
    mocked.fetchTrip.mockResolvedValue(detail({ revealed: false, endsAt: revealAt, revealAt }));
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    await waitFor(() =>
      expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: `reveal.${SUR}`,
          content: expect.objectContaining({ title: "Se reveló Viaje al sur" }),
          trigger: { type: "date", date: revealAt },
        }),
      ),
    );
  });

  it("tapping it makes that roll the active one and goes to the gallery", async () => {
    await session(SUR); // SUR is active; the notification is for OTRO
    mocked.fetchTrip.mockResolvedValue(detail());
    await markPresentationSeen(OTRO);
    notifications.useLastNotificationResponse.mockReturnValue({
      notification: { request: { content: { data: { tripId: OTRO } } } },
    } as never);
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    await waitFor(async () => expect(await getActiveTripId()).toBe(OTRO));
    // The tap handler navigates after saving the id; let it finish so it can't leak into the next test.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    await waitFor(() => expect(screen).toHavePathname("/roll"));
  });
});

describe("permission", () => {
  it("asks for notification permission after joining a roll", async () => {
    mocked.joinTrip.mockResolvedValue(detail().trip);
    mocked.fetchTrip.mockResolvedValue(detail({ revealed: false, revealAt: Date.now() + DAY }));
    await renderRouter(testRoutes, { initialUrl: "/join" });

    await screen.findByLabelText("Código del rollo");
    await fireEvent.changeText(screen.getByLabelText("Código del rollo"), "HUB5FT");
    await waitFor(() => expect(screen.getByRole("button", { name: "Unirme" })).toBeEnabled());
    await fireEvent.press(screen.getByRole("button", { name: "Unirme" }));

    await waitFor(() => expect(mocked.joinTrip).toHaveBeenCalled());
    await waitFor(() => expect(notifications.requestPermissionsAsync).toHaveBeenCalled());
  });
});
