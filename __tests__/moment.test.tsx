import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { act, fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import * as actions from "@/features/trips/actions";
import { MOMENT_WINDOW_MS } from "@/features/moments/plan";
import * as media from "@/features/capture/media";
import { queryClient } from "@/api/query-client";
import { localDay } from "@/features/capture/quota";
import { createQueue, type Queue } from "@/features/capture/queue";
import { signInAs, tripSummary } from "@/test/account";
import { memoryDb } from "@/test/sqlite-memory";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/capture/media");
jest.mock("@/features/capture/location", () => ({
  startFix: jest.fn(async () => ({ lat: -49.33, lng: -72.89, accuracyM: 12 })),
}));
jest.mock("@/features/capture/store", () => ({ getQueue: jest.fn() }));
jest.mock("@/features/capture/sync", () => ({ syncQueue: jest.fn(async () => {}) }));
jest.mock("expo-crypto", () => {
  let n = 0;
  return { randomUUID: () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++n).padStart(12, "0")}` };
});
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: "success" },
}));

const trips = jest.mocked(actions);
const mediaMock = jest.mocked(media);
const { getQueue } = jest.requireMock("@/features/capture/store") as { getQueue: jest.Mock };
const vision = jest.requireMock("react-native-vision-camera") as {
  __photo: (path: string, width: number, height: number, orientation?: string) => unknown;
  __capturePhoto: jest.Mock;
  __granted: unknown;
  useCameraPermission: jest.Mock;
};
const takePhoto = vision.__capturePhoto;
const { useCameraPermission } = vision;
/** The next photo the camera takes (stored upright, so its size is as given). */
const nextShot = (uri: string, width: number, height: number) =>
  takePhoto.mockImplementationOnce(async () => vision.__photo(uri.replace("file://", ""), width, height, "up"));

const SUR = "11111111-1111-4111-8111-111111111111";
const TZ = "America/Argentina/Buenos_Aires";
const DAY = 24 * 60 * 60 * 1000;
const MOMENT_DAY = "2027-01-05";

function tripDetail(momentMode: "off" | "photo" | "photo_selfie"): actions.TripDetail {
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
      dailyVideoLimit: 0,
      featuringDisabled: false,
      photoLimitMode: "daily",
      totalPhotoLimit: null,
      momentMode,
      momentWindowStart: 540,
      momentWindowEnd: 1380,
    },
    me: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin", blockedByMe: false },
    members: [],
    today: { date: localDay(Date.now(), TZ), photosLeft: 7, videosLeft: 0 },
    totalUploaded: 0,
  };
}

let queue: Queue;

beforeEach(async () => {
  queue = await createQueue(memoryDb());
  getQueue.mockResolvedValue(queue);
  takePhoto.mockClear();
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur", { role: "admin" })] });
  trips.fetchTrip.mockResolvedValue(tripDetail("photo_selfie"));
  mediaMock.prepareMedia.mockResolvedValue({
    originalUri: "file:///docs/pending/a/original.jpg",
    thumbUri: "file:///docs/pending/a/thumb.jpg",
    width: 4000,
    height: 3000,
    sizeBytes: 2_500_000,
    durationS: null,
    thumbhash: null,
  });
});

async function openMoment(at: number, extra = `&trip=${SUR}`) {
  await renderRouter(routes, { initialUrl: "/roll" });
  await act(async () => router.push(`/moment?day=${MOMENT_DAY}&at=${at}${extra}` as never));
}

describe("Moment", () => {
  it("with the window open it shows the countdown and the back camera", async () => {
    await openMoment(Date.now() - (MOMENT_WINDOW_MS - 192_000)); // 3:12 left
    expect(await screen.findByText("Tu momento · quedan 3:12")).toBeVisible();
    expect(screen.getByTestId("camera-back")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sacar foto" })).toBeVisible();
  });

  it("with the window gone it says so and does not open the camera", async () => {
    await openMoment(Date.now() - MOMENT_WINDOW_MS - 100_000);
    expect(await screen.findByText("Se pasó tu momento de hoy")).toBeVisible();
    expect(screen.getByText("Mañana te toca otro.")).toBeVisible();
    expect(screen.queryByTestId("camera-back")).toBeNull();
  });

  it("without camera permission it shows the same message as the regular capture", async () => {
    useCameraPermission.mockReturnValueOnce({ status: "denied", hasPermission: false, canRequestPermission: false, requestPermission: jest.fn() });
    useCameraPermission.mockReturnValue({ status: "denied", hasPermission: false, canRequestPermission: false, requestPermission: jest.fn() });
    await openMoment(Date.now() - 10_000);
    expect(await screen.findByText("Rollo necesita la cámara")).toBeVisible();
    useCameraPermission.mockReset();
    useCameraPermission.mockReturnValue(vision.__granted);
  });

  it("in a photo_selfie roll it asks for the selfie after the photo and sends both with the moment day", async () => {
    await openMoment(Date.now() - 10_000);
    await fireEvent.press(await screen.findByRole("button", { name: "Sacar foto" }));

    expect(await screen.findByTestId("camera-front")).toBeVisible();
    expect(screen.getByText("Ahora con la otra cámara.")).toBeVisible();
    nextShot("file:///cache/Camera/selfie.jpg", 1500, 2000);
    await fireEvent.press(screen.getByRole("button", { name: "Sacar foto" }));

    await fireEvent.changeText(await screen.findByLabelText("Caption"), "el momento");
    await fireEvent.press(screen.getByRole("button", { name: "Mandar al rollo" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    const items = await queue.pending();
    expect(items).toHaveLength(2);
    const main = items.find((i) => i.pairedWith == null)!;
    const selfie = items.find((i) => i.pairedWith != null)!;
    expect(main).toMatchObject({ momentDay: MOMENT_DAY, caption: "el momento", tripId: SUR });
    expect(selfie).toMatchObject({ momentDay: MOMENT_DAY, pairedWith: main.id, caption: null });
    expect(mediaMock.prepareMedia).toHaveBeenCalledWith(expect.objectContaining({ uri: "file:///cache/Camera/selfie.jpg" }), selfie.id, expect.anything(), {
      maxDimension: 1080,
    });
  });

  it("before the first photo the camera can be flipped (starts on the back); the first photo is the main whichever camera took it", async () => {
    trips.fetchTrip.mockResolvedValue(tripDetail("photo"));
    await openMoment(Date.now() - 10_000);
    expect(await screen.findByTestId("camera-back")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Dar vuelta la cámara" }));
    expect(await screen.findByTestId("camera-front")).toBeVisible();
    nextShot("file:///cache/Camera/front.jpg", 1500, 2000);
    await fireEvent.press(screen.getByRole("button", { name: "Sacar foto" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Mandar al rollo" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    const items = await queue.pending();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ momentDay: MOMENT_DAY, pairedWith: null });
    expect(mediaMock.prepareMedia).toHaveBeenCalledWith(expect.objectContaining({ uri: "file:///cache/Camera/front.jpg" }), items[0]!.id, expect.anything(), {
      maxDimension: 1080,
    });
  });

  it("in a photo_selfie roll a front first photo is the main (1080) and the second is the back camera (normal size), linked to it", async () => {
    await openMoment(Date.now() - 10_000);
    expect(await screen.findByText("Sacás con las dos cámaras. La primera va a ser la grande.")).toBeVisible();
    await fireEvent.press(await screen.findByRole("button", { name: "Dar vuelta la cámara" }));
    nextShot("file:///cache/Camera/first-front.jpg", 1500, 2000);
    await fireEvent.press(await screen.findByRole("button", { name: "Sacar foto" }));

    expect(await screen.findByTestId("camera-back")).toBeVisible();
    expect(screen.getByText("Ahora con la otra cámara.")).toBeVisible();
    expect(screen.queryByText("Sacás con las dos cámaras. La primera va a ser la grande.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Dar vuelta la cámara" })).toBeNull();
    nextShot("file:///cache/Camera/second-back.jpg", 4000, 3000);
    await fireEvent.press(screen.getByRole("button", { name: "Sacar foto" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Mandar al rollo" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    const items = await queue.pending();
    const main = items.find((i) => i.pairedWith == null)!;
    const linked = items.find((i) => i.pairedWith != null)!;
    expect(linked.pairedWith).toBe(main.id);
    const calls = mediaMock.prepareMedia.mock.calls;
    const mainCall = calls.find((c) => (c[0] as { uri: string }).uri.endsWith("first-front.jpg"))!;
    const linkedCall = calls.find((c) => (c[0] as { uri: string }).uri.endsWith("second-back.jpg"))!;
    expect(mainCall[3]).toEqual({ maxDimension: 1080 });
    expect(linkedCall[3]).toBeUndefined();
  });

  it("the caption of a two-camera moment also shows the second photo, blurred, in an inset (no swapping)", async () => {
    await openMoment(Date.now() - 10_000);
    await fireEvent.press(await screen.findByRole("button", { name: "Sacar foto" }));
    nextShot("file:///cache/Camera/selfie.jpg", 1500, 2000);
    await fireEvent.press(await screen.findByRole("button", { name: "Sacar foto" }));

    await screen.findByLabelText("Caption");
    const inset = screen.getByTestId("caption-inset");
    expect(inset).toBeVisible();
    expect(screen.queryByRole("button", { name: "Ver la otra foto" })).toBeNull();
    const image = within(inset).getByTestId("caption-inset-image");
    expect([image.props.source].flat()).toEqual([{ uri: "file:///cache/Camera/selfie.jpg" }]);
    expect(image.props.blurRadius).toBeGreaterThan(0);
  });

  it("the caption of a one-photo moment has no inset", async () => {
    trips.fetchTrip.mockResolvedValue(tripDetail("photo"));
    await openMoment(Date.now() - 10_000);
    await fireEvent.press(await screen.findByRole("button", { name: "Sacar foto" }));
    await screen.findByLabelText("Caption");
    expect(screen.queryByTestId("caption-inset")).toBeNull();
  });

  it("in a photo roll it goes straight to the caption after the photo", async () => {
    trips.fetchTrip.mockResolvedValue(tripDetail("photo"));
    await openMoment(Date.now() - 10_000);
    await fireEvent.press(await screen.findByRole("button", { name: "Sacar foto" }));

    expect(await screen.findByRole("button", { name: "Mandar al rollo" })).toBeVisible();
    expect(screen.queryByTestId("camera-front")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Mandar al rollo" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    const items = await queue.pending();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ momentDay: MOMENT_DAY, pairedWith: null });
  });

  it("once the moment is sent the banner in Rollo goes away", async () => {
    trips.fetchTrip.mockResolvedValue(tripDetail("photo"));
    trips.fetchFeed.mockResolvedValue({ revealed: false, revealAt: Date.now() + 4 * DAY, items: [] } as never);
    const at = Date.now() - 10_000;
    let delivered = [
      { date: at, request: { identifier: `moment.${SUR}.${MOMENT_DAY}`, content: { data: { url: `/moment?trip=${SUR}&day=${MOMENT_DAY}&at=${at}` } } } },
    ];
    (Notifications.getPresentedNotificationsAsync as jest.Mock).mockImplementation(async () => delivered);
    (Notifications.dismissNotificationAsync as jest.Mock).mockImplementation(async (id: string) => {
      delivered = delivered.filter((n) => n.request.identifier !== id);
    });
    await openMoment(at);
    await fireEvent.press(await screen.findByRole("button", { name: "Sacar foto" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Mandar al rollo" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith(`moment.${SUR}.${MOMENT_DAY}`);
    await waitFor(() => expect(screen.queryByText(/Tu momento/)).toBeNull());
    (Notifications.getPresentedNotificationsAsync as jest.Mock).mockResolvedValue([]);
  });

  it("without a trip param it uses the active trip", async () => {
    trips.fetchTrip.mockResolvedValue(tripDetail("photo"));
    await openMoment(Date.now() - 10_000, "");
    await fireEvent.press(await screen.findByRole("button", { name: "Sacar foto" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Mandar al rollo" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect((await queue.pending())[0]).toMatchObject({ tripId: SUR });
  });

  it("on the first-shot step Cerrar closes the screen and nothing is queued", async () => {
    await openMoment(Date.now() - 10_000);
    await fireEvent.press(await screen.findByRole("button", { name: "Cerrar" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(await queue.pending()).toHaveLength(0);
  });

  it("on the selfie step there is no Cerrar", async () => {
    await openMoment(Date.now() - 10_000);
    await fireEvent.press(await screen.findByRole("button", { name: "Sacar foto" }));

    expect(await screen.findByTestId("camera-front")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Cerrar" })).toBeNull();
  });

  it("never waits for the trip detail: with it pending forever and selfie=1 in the url it shoots the photo and then the selfie", async () => {
    trips.fetchTrip.mockReturnValue(new Promise(() => {}));
    await openMoment(Date.now() - 10_000, `&trip=${SUR}&selfie=1`);

    await fireEvent.press(await screen.findByRole("button", { name: "Sacar foto" }));
    expect(await screen.findByTestId("camera-front")).toBeVisible();
    nextShot("file:///cache/Camera/selfie.jpg", 1500, 2000);
    await fireEvent.press(screen.getByRole("button", { name: "Sacar foto" }));

    await fireEvent.press(await screen.findByRole("button", { name: "Mandar al rollo" }));
    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(await queue.pending()).toHaveLength(2);
  });

  it("with selfie=0 in the url there is no selfie step even if the detail says photo_selfie", async () => {
    await openMoment(Date.now() - 10_000, `&trip=${SUR}&selfie=0`);
    await fireEvent.press(await screen.findByRole("button", { name: "Sacar foto" }));

    expect(await screen.findByRole("button", { name: "Mandar al rollo" })).toBeVisible();
    expect(screen.queryByTestId("camera-front")).toBeNull();
  });

  it("with no selfie param and no detail it is photo-only", async () => {
    trips.fetchTrip.mockReturnValue(new Promise(() => {}));
    await openMoment(Date.now() - 10_000);
    await fireEvent.press(await screen.findByRole("button", { name: "Sacar foto" }));

    expect(await screen.findByRole("button", { name: "Mandar al rollo" })).toBeVisible();
    expect(screen.queryByTestId("camera-front")).toBeNull();
  });

  it("with no selfie param it follows the detail once it is loaded", async () => {
    await openMoment(Date.now() - 10_000);
    await waitFor(() => expect(trips.fetchTrip).toHaveBeenCalled());
    await act(async () => {});
    await fireEvent.press(await screen.findByRole("button", { name: "Sacar foto" }));

    expect(await screen.findByTestId("camera-front")).toBeVisible();
  });

  it("shows Cerrar while the camera permission is being asked", async () => {
    useCameraPermission.mockReturnValueOnce({ status: "not-determined", hasPermission: false, canRequestPermission: true, requestPermission: jest.fn(async () => false) });
    useCameraPermission.mockReturnValue({ status: "not-determined", hasPermission: false, canRequestPermission: true, requestPermission: jest.fn(async () => false) });
    await openMoment(Date.now() - 10_000);

    await fireEvent.press(await screen.findByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen).toHavePathname("/roll"));
    useCameraPermission.mockReset();
    useCameraPermission.mockReturnValue(vision.__granted);
  });

  it("when taking the picture fails it shows an inline error and lets the user retry", async () => {
    takePhoto.mockRejectedValueOnce(new Error("camera busy"));
    await openMoment(Date.now() - 10_000, `&trip=${SUR}&selfie=0`);
    await fireEvent.press(await screen.findByRole("button", { name: "Sacar foto" }));

    expect(await screen.findByText("No se pudo sacar la foto. Probá de nuevo.")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Sacar foto" }));
    expect(await screen.findByRole("button", { name: "Mandar al rollo" })).toBeVisible();
  });

  it("on the last day of the rollo the late screen says it was the last one", async () => {
    trips.fetchTrip.mockResolvedValue({ ...tripDetail("photo"), trip: { ...tripDetail("photo").trip, endsAt: Date.parse("2027-01-05T20:00:00Z") } });
    await openMoment(Date.now() - MOMENT_WINDOW_MS - 100_000);

    expect(await screen.findByText("Era el último del rollo.")).toBeVisible();
    expect(screen.queryByText("Mañana te toca otro.")).toBeNull();
  });

  it("the last day also comes from the rollo list when the detail is not loaded", async () => {
    trips.fetchTrip.mockReturnValue(new Promise(() => {}));
    await signInAs({ trips: [tripSummary(SUR, "Viaje al sur", { role: "admin", endsAt: Date.parse("2027-01-05T20:00:00Z") })] });
    await openMoment(Date.now() - MOMENT_WINDOW_MS - 100_000);

    expect(await screen.findByText("Era el último del rollo.")).toBeVisible();
  });

  it("the self-timer works in the moment too: the countdown shoots at 0 and that photo is the main", async () => {
    trips.fetchTrip.mockResolvedValue(tripDetail("photo"));
    await openMoment(Date.now() - 10_000);
    await fireEvent.press(await screen.findByRole("button", { name: "Temporizador: apagado" }));
    await fireEvent.press(screen.getByRole("button", { name: "Sacar foto" }));
    expect(screen.getByTestId("timer-countdown")).toHaveTextContent("3");
    expect(takePhoto).not.toHaveBeenCalled();
    // renderRouter runs on Jest's fake timers.
    for (let s = 0; s < 3; s++) await act(async () => jest.advanceTimersByTime(1000));
    expect(takePhoto).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText("Caption")).toBeVisible();
  });
});
