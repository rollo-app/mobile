import { router } from "expo-router";
import { AccessibilityInfo } from "react-native";
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
  // Stable across renders, like the real one (the screen's effect depends on it).
  useSharedValue: (value: number) => jest.requireActual("react").useRef({ value }).current,
  useAnimatedStyle: (style: () => object) => style(),
  withDelay: (_ms: number, value: number) => value,
  withTiming: (value: number) => value,
  Easing: { bezier: () => () => 0 },
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
      featuringDisabled: false,
      photoLimitMode: "daily",
      totalPhotoLimit: null,
      momentMode: "off",
      momentWindowStart: 540,
      momentWindowEnd: 1380,
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

// The buttons and copy appear after 1500 ms (real timers: fake ones stall the router's async rendering).
const SHOWN_WITHIN = { timeout: 4000 };

describe("roll started", () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });
  afterAll(() => {
    // Not mockRestore: it would wipe React Native's own jest.fn for later suites.
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  });

  it("keeps the buttons inert and hidden from accessibility until the text shows", async () => {
    await openRollStarted();
    await screen.findByLabelText("Candado");
    expect(screen.queryByText("Ahora no")).not.toBeOnTheScreen();
    expect(screen.queryByText("Arrancó el rollo.")).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Ahora no", { includeHiddenElements: true }));
    expect(screen).toHavePathname("/roll-started");
    await fireEvent.press(await screen.findByText("Ahora no", {}, SHOWN_WITHIN));
    expect(screen).toHavePathname("/roll");
  });

  it("runs the same phases with Reduce Motion on", async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    await openRollStarted();
    expect(await screen.findByText("Sacar la primera", {}, SHOWN_WITHIN)).toBeOnTheScreen();
  });

  it("tells you the roll started and today's photos on the active roll", async () => {
    await openRollStarted();
    expect(await screen.findByText("Arrancó el rollo.", {}, SHOWN_WITHIN)).toBeOnTheScreen();
    expect(await screen.findByText("Tenés 7 fotos hoy.", {}, SHOWN_WITHIN)).toBeOnTheScreen();
  });

  it("says the photos left in the whole rollo when the limit is total", async () => {
    const d = tripDetail(18);
    trips.fetchTrip.mockResolvedValue({ ...d, trip: { ...d.trip, photoLimitMode: "total", totalPhotoLimit: 20 } });
    await openRollStarted();
    expect(await screen.findByText("Tenés 18 fotos en el rollo.", {}, SHOWN_WITHIN)).toBeOnTheScreen();
  });

  it("says one photo in singular", async () => {
    trips.fetchTrip.mockResolvedValue(tripDetail(1));
    await openRollStarted();
    expect(await screen.findByText("Tenés 1 foto hoy.", {}, SHOWN_WITHIN)).toBeOnTheScreen();
  });

  it("shows the lock with the SF Symbol when the native module isn't in the build", async () => {
    await openRollStarted();
    expect((await screen.findByLabelText("Candado")).props.name).toBe("lock.fill");
  });

  it("opens the camera from \"Sacar la primera\"", async () => {
    await openRollStarted();
    await fireEvent.press(await screen.findByText("Sacar la primera", {}, SHOWN_WITHIN));
    expect(screen).toHavePathname("/capture");
  });

  it("closes with \"Ahora no\"", async () => {
    await openRollStarted();
    await fireEvent.press(await screen.findByText("Ahora no", {}, SHOWN_WITHIN));
    expect(screen).toHavePathname("/roll");
  });
});
