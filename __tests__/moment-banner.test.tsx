import * as Notifications from "expo-notifications";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as actions from "@/features/trips/actions";
import { MOMENT_WINDOW_MS } from "@/features/moments/plan";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");

const trips = jest.mocked(actions);
const presented = Notifications.getPresentedNotificationsAsync as jest.Mock;

const SUR = "11111111-1111-4111-8111-111111111111";
const DAY = 24 * 60 * 60 * 1000;

function tripDetail(): actions.TripDetail {
  return {
    trip: {
      id: SUR,
      name: "Viaje al sur",
      joinCode: "HUB5FT",
      timezone: "America/Argentina/Buenos_Aires",
      startsAt: Date.now() - DAY,
      endsAt: Date.now() + 9 * DAY,
      revealAt: Date.now() + 9 * DAY,
      revealed: false,
      dailyPhotoLimit: 10,
      dailyVideoLimit: 0,
      featuringDisabled: false,
      photoLimitMode: "daily",
      totalPhotoLimit: null,
      momentMode: "photo",
      momentWindowStart: 540,
      momentWindowEnd: 1380,
    },
    me: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin", blockedByMe: false },
    members: [],
    today: { date: "2027-01-12", photosLeft: 7, videosLeft: 0 },
    totalUploaded: 0,
  };
}

const deliveredAt = (at: number) => [
  {
    date: at,
    request: {
      identifier: `moment.${SUR}.2027-01-12`,
      content: { data: { url: `/moment?trip=${SUR}&day=2027-01-12&at=${at}` } },
    },
  },
];

beforeEach(async () => {
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur", { role: "admin" })] });
  trips.fetchTrip.mockResolvedValue(tripDetail());
  trips.fetchFeed.mockResolvedValue({ revealed: false, revealAt: Date.now() + 4 * DAY, items: [] } as never);
  presented.mockResolvedValue([]);
});

describe("Moment banner in Rollo", () => {
  it("shows nothing when no moment was delivered", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });
    expect(await screen.findByText("En el rollo")).toBeVisible();
    expect(screen.queryByText(/Tu momento/)).toBeNull();
  });

  it("shows nothing for a delivered moment whose window is over", async () => {
    presented.mockResolvedValue(deliveredAt(Date.now() - MOMENT_WINDOW_MS - 100_000));
    await renderRouter(routes, { initialUrl: "/roll" });
    expect(await screen.findByText("En el rollo")).toBeVisible();
    expect(screen.queryByText(/Tu momento/)).toBeNull();
  });

  it("shows the countdown for an open moment and opens /moment when tapped", async () => {
    presented.mockResolvedValue(deliveredAt(Date.now() - 120_000));
    await renderRouter(routes, { initialUrl: "/roll" });
    expect(await screen.findByText(/^Tu momento · quedan 12:5\d$/)).toBeVisible();

    await fireEvent.press(screen.getByRole("button", { name: /^Tu momento · quedan/ }));
    expect(screen).toHavePathname("/moment");
  });

  it("appears when the moment fires while Rollo is open", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });
    expect(await screen.findByText("En el rollo")).toBeVisible();
    expect(screen.queryByText(/Tu momento/)).toBeNull();

    presented.mockResolvedValue(deliveredAt(Date.now()));
    const listener = (Notifications.addNotificationReceivedListener as jest.Mock).mock.calls.at(-1)![0];
    await act(async () => listener({}));

    expect(await screen.findByText(/^Tu momento · quedan/)).toBeVisible();
  });

  it("goes away when the window closes", async () => {
    presented.mockResolvedValue(deliveredAt(Date.now() - (MOMENT_WINDOW_MS - 1_500)));
    await renderRouter(routes, { initialUrl: "/roll" });
    expect(await screen.findByText(/^Tu momento · quedan/)).toBeVisible();
    await waitFor(() => expect(screen.queryByText(/Tu momento/)).toBeNull(), { timeout: 4000 });
  });
});
