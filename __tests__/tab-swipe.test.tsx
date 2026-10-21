import { act, renderRouter, screen } from "expo-router/testing-library";
import { queryClient } from "@/api/query-client";
import * as actions from "@/features/trips/actions";
import { markPresentationSeen } from "@/storage/presentation";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
const mocked = jest.mocked(actions);

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";

const detail = (revealed = false): actions.TripDetail => ({
  trip: {
    id: SUR, name: "Viaje al sur", joinCode: "HUB5FT", timezone: "America/Argentina/Buenos_Aires",
    startsAt: Date.now() - 2 * DAY, endsAt: revealed ? Date.now() - DAY : Date.now() + 9 * DAY,
    revealAt: revealed ? Date.now() - DAY : Date.now() + 9 * DAY, revealed,
    dailyPhotoLimit: 10, dailyVideoLimit: 3,
  },
  me: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin" },
  members: [{ id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin" }],
  today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 12,
});

let stamp = 1000;
/** A responder event with the touch history PanResponder reads. */
function touch(x: number, y: number, start: { x: number; y: number }) {
  stamp += 20;
  const t = { touchActive: true, startPageX: start.x, startPageY: start.y, startTimeStamp: 1000, currentPageX: x, currentPageY: y, currentTimeStamp: stamp, previousPageX: start.x, previousPageY: start.y, previousTimeStamp: stamp - 20 };
  return {
    nativeEvent: { touches: [{}], changedTouches: [{}], pageX: x, pageY: y, timestamp: stamp, touchHistory: { touchBank: [t], numberActiveTouches: 1, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: stamp } },
    touchHistory: { touchBank: [t], numberActiveTouches: 1, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: stamp },
  };
}

/** Drags the finger from `from` to `to` on the swipe wrapper, like the responder system would. */
async function drag(tab: "roll" | "feed" | "me", from: [number, number], to: [number, number]) {
  const view = screen.getByTestId(`tab-swipe-${tab}`);
  const start = { x: from[0], y: from[1] };
  await act(async () => {
    const claimed = view.props.onMoveShouldSetResponder(touch(to[0], to[1], start));
    if (!claimed) return;
    view.props.onResponderGrant(touch(to[0], to[1], start));
    view.props.onResponderMove(touch(to[0], to[1], start));
    view.props.onResponderRelease(touch(to[0], to[1], start));
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  mocked.fetchTrip.mockResolvedValue(detail());
  mocked.fetchFeed.mockResolvedValue({ revealed: false, revealAt: Date.now() + DAY, items: [] });
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")], active: SUR });
});

describe("swiping between tabs", () => {
  it("Perfil goes to Feed when dragging left to right", async () => {
    await renderRouter(routes, { initialUrl: "/me" });
    await screen.findByRole("button", { name: "Editar perfil" });

    await drag("me", [100, 300], [220, 305]);

    expect(screen).toHavePathname("/feed");
  });

  it("Feed goes to Rollo, and Rollo goes back to Feed from right to left", async () => {
    await renderRouter(routes, { initialUrl: "/feed" });
    await screen.findByTestId("feed-list");

    await drag("feed", [100, 300], [220, 300]);
    expect(screen).toHavePathname("/roll");

    await screen.findByTestId("tab-swipe-roll");
    await drag("roll", [300, 300], [150, 300]);
    expect(screen).toHavePathname("/feed");
  });

  it("does nothing at the ends", async () => {
    await renderRouter(routes, { initialUrl: "/me" });
    await screen.findByRole("button", { name: "Editar perfil" });

    await drag("me", [300, 300], [150, 300]);

    expect(screen).toHavePathname("/me");
  });

  it("ignores vertical drags and drags that start at the left edge", async () => {
    await renderRouter(routes, { initialUrl: "/me" });
    await screen.findByRole("button", { name: "Editar perfil" });

    await drag("me", [100, 200], [130, 400]);
    await drag("me", [5, 300], [220, 300]);

    expect(screen).toHavePathname("/me");
  });

  it("skips the hidden Feed after the reveal: Perfil goes to the gallery", async () => {
    mocked.fetchTrip.mockResolvedValue(detail(true));
    await markPresentationSeen(SUR);
    await renderRouter(routes, { initialUrl: "/me" });
    await screen.findByTestId("tab-swipe-me");
    await act(async () => {
      await queryClient.refetchQueries();
    });

    await drag("me", [100, 300], [220, 300]);

    expect(screen).toHavePathname("/roll");
  });
});
