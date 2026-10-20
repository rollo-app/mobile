import * as Notifications from "expo-notifications";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Text } from "react-native";
import * as actions from "@/features/trips/actions";
import { hasSeenPresentation, markPresentationSeen } from "@/storage/presentation";
import { listTrips, saveSession } from "@/storage/trips";
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
  me: { id: "m1", name: "Juani", role: "admin" },
  members: [{ id: "m1", name: "Juani", role: "admin" }],
  today: { date: "2027-01-12", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 3,
});

const session = (tripId = SUR) =>
  saveSession({ tripId, tripName: "Viaje al sur", joinCode: "HUB5FT", memberId: "m1", memberName: "Juani", role: "admin", token: "t" });

const testRoutes = { ...routes, "photo/[id]": () => <Text>Foto</Text> };

afterEach(() => notifications.useLastNotificationResponse.mockReturnValue(null));

beforeEach(async () => {
  jest.clearAllMocks();
  mocked.fetchFeed.mockResolvedValue({ revealed: true, revealAt: Date.now() - DAY, items: [] });
  await session();
});

describe("revealed roll", () => {
  it("the Rollo tab shows the gallery instead of the board", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await markPresentationSeen(SUR);
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    expect(await screen.findByText("Este rollo no tiene fotos")).toBeVisible();
    expect(screen.queryByText("Fechas")).toBeNull();
  });

  it("opens the presentation automatically the first time, and only once", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    mocked.fetchFeed.mockResolvedValue({
      revealed: true,
      revealAt: Date.now() - DAY,
      items: [
        {
          id: "a", type: "photo", takenAt: Date.now() - DAY, day: "2027-01-12", lat: null, lng: null, caption: null,
          thumbhash: null, durationS: null, author: { id: "m1", name: "Juani" },
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
    await session(OTRO);
    await session(SUR); // SUR is active; the notification is for OTRO
    mocked.fetchTrip.mockResolvedValue(detail());
    await markPresentationSeen(OTRO);
    notifications.useLastNotificationResponse.mockReturnValue({
      notification: { request: { content: { data: { tripId: OTRO } } } },
    } as never);
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    await waitFor(async () => expect((await listTrips())[0]!.tripId).toBe(OTRO));
    await waitFor(() => expect(screen).toHavePathname("/roll"));
  });
});

describe("permission", () => {
  it("asks for notification permission after joining a roll", async () => {
    mocked.joinTrip.mockResolvedValue(detail().trip);
    mocked.fetchTrip.mockResolvedValue(detail({ revealed: false, revealAt: Date.now() + DAY }));
    await renderRouter(testRoutes, { initialUrl: "/join" });

    await fireEvent.changeText(await screen.findByLabelText("Código del rollo"), "HUB5FT");
    await fireEvent.changeText(screen.getByLabelText("Tu nombre"), "Juani");
    await fireEvent.press(screen.getByRole("button", { name: "Unirme" }));

    await waitFor(() => expect(mocked.joinTrip).toHaveBeenCalled());
    await waitFor(() => expect(notifications.requestPermissionsAsync).toHaveBeenCalled());
  });
});
