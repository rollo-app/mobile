import { router } from "expo-router";
import { act, fireEvent, renderRouter, screen } from "expo-router/testing-library";
import * as actions from "@/features/trips/actions";
import { localDay } from "@/features/capture/quota";
import { signInAs, tripSummary } from "@/test/account";

// jest.setup mocks the screen out for the other tests; here we render the real one.
jest.unmock("@/features/capture/roll-started");
jest.mock("@/features/trips/actions");
// The camera screen asks for permission as soon as it opens: denied, so it stays put.
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: false })),
  launchCameraAsync: jest.fn(),
}));
// Reanimated is native and its bundled mock doesn't load under Jest, so expo-router's testing library
// mocks it as an empty object. Fill that object with just enough to render, before the routes (and
// this screen) are loaded.
Object.assign(require("react-native-reanimated"), {
  __esModule: true,
  default: { View: jest.requireActual("react-native").View },
  useSharedValue: (value: number) => ({ value }),
  useAnimatedStyle: (style: () => object) => style(),
  withDelay: (_ms: number, value: number) => value,
  withTiming: (value: number) => value,
});
const { routes } = require("@/test/routes") as typeof import("@/test/routes");

const trips = jest.mocked(actions);
const SUR = "11111111-1111-4111-8111-111111111111";
const TZ = "America/Argentina/Buenos_Aires";
const DAY = 24 * 60 * 60 * 1000;

function tripDetail(photosLeft: number): actions.TripDetail {
  return {
    trip: {
      id: SUR,
      name: "Viaje al sur",
      joinCode: "HUB5FT",
      timezone: TZ,
      startsAt: Date.now() - DAY,
      endsAt: Date.now() + 9 * DAY,
      revealAt: Date.now() + 9 * DAY,
      revealed: false,
      dailyPhotoLimit: 10,
      dailyVideoLimit: 3,
    },
    me: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin", blockedByMe: false },
    members: [],
    today: { date: localDay(Date.now(), TZ), photosLeft, videosLeft: 3 },
    totalUploaded: 0,
  };
}

beforeEach(async () => {
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur", { role: "admin" })] });
  trips.fetchTrip.mockResolvedValue(tripDetail(7));
});

async function openRollStarted() {
  await renderRouter(routes, { initialUrl: "/roll" });
  await act(async () => router.push("/roll-started"));
}

describe("roll started", () => {
  it("tells you the roll started and today's photos on the active roll", async () => {
    await openRollStarted();
    expect(await screen.findByText("Arrancó el rollo.")).toBeOnTheScreen();
    expect(await screen.findByText("Tenés 7 fotos hoy.")).toBeOnTheScreen();
  });

  it("says one photo in singular", async () => {
    trips.fetchTrip.mockResolvedValue(tripDetail(1));
    await openRollStarted();
    expect(await screen.findByText("Tenés 1 foto hoy.")).toBeOnTheScreen();
  });

  it("shows the lock with the SF Symbol when the native module isn't in the build", async () => {
    await openRollStarted();
    expect((await screen.findByLabelText("Candado")).props.name).toBe("lock.fill");
  });

  it("opens the camera from \"Sacar la primera\"", async () => {
    await openRollStarted();
    await fireEvent.press(await screen.findByText("Sacar la primera"));
    expect(screen).toHavePathname("/capture");
  });

  it("closes with \"Ahora no\"", async () => {
    await openRollStarted();
    await fireEvent.press(await screen.findByText("Ahora no"));
    expect(screen).toHavePathname("/roll");
  });
});
