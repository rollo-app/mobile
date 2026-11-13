import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { createQueryClient } from "@/api/query-client";
import type { TripDetail } from "@/features/trips/actions";
import { setSessionUserId } from "@/storage/session-user";
import { getLastGroups, setLastGroups } from "@/storage/last-groups";
import { memoryDb } from "@/test/sqlite-memory";
import { CaptureScreen } from "../capture-screen";
import { startFix } from "../location";
import * as media from "../media";
import { createQueue, type Queue } from "../queue";
import { getQueue } from "../store";

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View },
    cubicBezier: jest.fn(() => "curve"),
    ReduceMotion: { System: "system", Always: "always", Never: "never" },
    useAnimatedStyle: () => ({}),
    useSharedValue: (value: unknown) => ({ get: () => value, set: jest.fn() }),
    withTiming: (value: unknown) => value,
  };
});
jest.mock("@/ui/keyboard-lift", () => ({ useKeyboardLift: () => ({}) }));
jest.mock("@/ui/use-reduce-motion", () => ({ useReduceMotion: () => false }));
jest.mock("expo-haptics", () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: "success" } }));
jest.mock("expo-router", () => ({ ...jest.requireActual("expo-router"), router: { back: jest.fn() } }));
jest.mock("react-native-vision-camera", () => ({
  useCameraPermission: () => ({ hasPermission: true, canRequestPermission: false, requestPermission: jest.fn() }),
}));
jest.mock("@/features/camera/camera", () => {
  const { Pressable, Text } = require("react-native");
  return {
    Camera: ({ onCapture }: { onCapture: (photo: unknown) => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel="Sacar foto" onPress={() => onCapture({ uri: "file:///cache/IMG_1.jpg", width: 4000, height: 3000 })}>
        <Text>Sacar</Text>
      </Pressable>
    ),
  };
});
jest.mock("@/features/trips/use-active-trip", () => ({ useActiveTrip: () => ({ trip: { id: "t1" }, loaded: true }) }));
let mockDetail: TripDetail;
jest.mock("@/features/trips/use-trip-detail", () => ({ useTripDetail: () => ({ detail: mockDetail, error: null }) }));
jest.mock("../location", () => ({ startFix: jest.fn(async () => null) }));
jest.mock("../load-left", () => ({ loadLeft: jest.fn(async () => ({ photos: 10 })) }));
jest.mock("../media");
jest.mock("../store", () => ({ getQueue: jest.fn() }));
jest.mock("../sync", () => ({ syncQueue: jest.fn(async () => {}) }));

const GROUPS = [
  { id: "g1", name: "Novios" },
  { id: "g2", name: "Familia" },
  { id: "g3", name: "Amigos" },
];
const detail = (over: { type: "trip" | "event"; role: "admin" | "member"; groupIds: string[] }) =>
  ({
    trip: { id: "t1", type: over.type, groups: over.type === "event" ? GROUPS : [], timezone: "America/Argentina/Buenos_Aires", startsAt: 0, endsAt: 4e12, revealAt: 5e12, revealed: false },
    me: { name: "Juani", role: over.role, groupIds: over.groupIds },
    today: {},
  }) as unknown as TripDetail;

let queue: Queue;
const clients: ReturnType<typeof createQueryClient>[] = [];
const newClient = () => {
  const client = createQueryClient();
  clients.push(client);
  return client;
};

// Their gc timers would keep Jest from exiting.
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});
let enqueue: jest.SpyInstance;

beforeEach(async () => {
  queue = await createQueue(memoryDb());
  enqueue = jest.spyOn(queue, "enqueue");
  await setSessionUserId("u1");
  jest.mocked(getQueue).mockResolvedValue(queue);
  jest.mocked(startFix).mockClear();
  jest.mocked(media.prepareMedia).mockResolvedValue({
    originalUri: "file:///docs/o.jpg",
    thumbUri: "file:///docs/t.jpg",
    displayUri: "file:///docs/d.jpg",
    displaySizeBytes: 3,
    width: 10,
    height: 10,
    sizeBytes: 5,
    durationS: null,
    thumbhash: null,
  });
});

async function toPreview() {
  await render(
    <QueryClientProvider client={newClient()}>
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
        <CaptureScreen />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
  await fireEvent.press(await screen.findByLabelText("Sacar foto"));
  await screen.findByLabelText("Mandar al rollo");
}

describe("capture in an event", () => {
  it("an event never asks for location", async () => {
    mockDetail = detail({ type: "event", role: "member", groupIds: ["g1"] });
    await render(
      <QueryClientProvider client={newClient()}>
        <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
        <CaptureScreen />
      </SafeAreaProvider>
      </QueryClientProvider>,
    );
    await screen.findByLabelText("Sacar foto");

    expect(startFix).not.toHaveBeenCalled();
  });

  it("a guest in one group sees no chips and sends to it", async () => {
    mockDetail = detail({ type: "event", role: "member", groupIds: ["g2"] });
    await toPreview();

    expect(screen.queryByRole("checkbox")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Mandar al rollo"));

    await waitFor(() => expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ groupIds: ["g2"], lat: null, lng: null })));
  });

  it("a guest in two groups starts with the last used and can add the other", async () => {
    mockDetail = detail({ type: "event", role: "member", groupIds: ["g1", "g2"] });
    await setLastGroups("t1", ["g1", "gone"]);
    await toPreview();

    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Novios" })).toBeChecked());
    expect(screen.getByRole("checkbox", { name: "Familia" })).not.toBeChecked();
    expect(screen.queryByText("Todos los grupos")).toBeNull();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Familia" }));
    await fireEvent.press(screen.getByLabelText("Mandar al rollo"));

    await waitFor(() => expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ groupIds: ["g1", "g2"] })));
    expect(await getLastGroups("t1")).toEqual(["g1", "g2"]);
  });

  it("starts with the first group when none of the last used still applies", async () => {
    mockDetail = detail({ type: "event", role: "member", groupIds: ["g1", "g2"] });
    await setLastGroups("t1", ["gone"]);
    await toPreview();

    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Novios" })).toBeChecked());
    expect(screen.getByRole("checkbox", { name: "Familia" })).not.toBeChecked();
  });

  it("cannot send with no group checked", async () => {
    mockDetail = detail({ type: "event", role: "member", groupIds: ["g1", "g2"] });
    await toPreview();
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Novios" })).toBeChecked());

    await fireEvent.press(screen.getByRole("checkbox", { name: "Novios" }));

    expect(screen.getByLabelText("Mandar al rollo")).toBeDisabled();
  });

  it("an organizer sees Todos los grupos, and checking it chooses every group", async () => {
    mockDetail = detail({ type: "event", role: "admin", groupIds: [] });
    await toPreview();

    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Novios" })).toBeChecked());
    await fireEvent.press(screen.getByRole("checkbox", { name: "Todos los grupos" }));
    await fireEvent.press(screen.getByLabelText("Mandar al rollo"));

    await waitFor(() => expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ groupIds: ["g1", "g2", "g3"] })));
  });
});

describe("capture in a regular trip", () => {
  it("a trip shows no chips and still asks for location", async () => {
    mockDetail = detail({ type: "trip", role: "member", groupIds: [] });
    await toPreview();

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(startFix).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Mandar al rollo"));

    await waitFor(() => expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ groupIds: null })));
  });
});
