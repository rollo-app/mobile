import { router } from "expo-router";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as ImagePicker from "expo-image-picker";
import * as actions from "@/features/trips/actions";
import * as media from "@/features/capture/media";
import { startFix } from "@/features/capture/location";
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
jest.mock("expo-crypto", () => ({ randomUUID: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }));
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(),
  VideoExportPreset: { H264_1920x1080: 7 },
}));

const trips = jest.mocked(actions);
const picker = jest.mocked(ImagePicker);
const mediaMock = jest.mocked(media);
const { getQueue } = jest.requireMock("@/features/capture/store") as { getQueue: jest.Mock };
const { syncQueue } = jest.requireMock("@/features/capture/sync") as { syncQueue: jest.Mock };

const SUR = "11111111-1111-4111-8111-111111111111";
const TZ = "America/Argentina/Buenos_Aires";
const DAY = 24 * 60 * 60 * 1000;

const photo = { uri: "file:///cache/IMG_1.jpg", type: "image", width: 4032, height: 3024 } as ImagePicker.ImagePickerAsset;

function tripDetail(photosLeft: number, videosLeft: number): actions.TripDetail {
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
    today: { date: localDay(Date.now(), TZ), photosLeft, videosLeft },
    totalUploaded: 0,
  };
}

let queue: Queue;

beforeEach(async () => {
  queue = await createQueue(memoryDb());
  getQueue.mockResolvedValue(queue);
  picker.launchCameraAsync.mockReset();
  syncQueue.mockReset();
  syncQueue.mockResolvedValue(undefined);
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur", { role: "admin" })] });
  trips.fetchTrip.mockResolvedValue(tripDetail(7, 2));
  mediaMock.prepareMedia.mockResolvedValue({
    originalUri: "file:///docs/pending/a/original.jpg",
    thumbUri: "file:///docs/pending/a/thumb.jpg",
    width: 4000,
    height: 3000,
    sizeBytes: 2_500_000,
    thumbSizeBytes: 90_000,
    durationS: null,
    thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
  });
});

async function openCapture() {
  await renderRouter(routes, { initialUrl: "/roll" });
  // No testRouter.push: it asserts the route and the capture may return right away.
  await act(async () => router.push("/capture"));
}

describe("Capture", () => {
  it("opens the system camera with photo and video, and goes back if you cancel", async () => {
    picker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null });
    await openCapture();

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(picker.launchCameraAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ["images", "videos"], videoMaxDuration: 15 }),
    );
  });

  it("if you have no videos left today it opens the camera for photos only", async () => {
    trips.fetchTrip.mockResolvedValue(tripDetail(7, 0));
    picker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null });
    await openCapture();

    await waitFor(() => expect(picker.launchCameraAsync).toHaveBeenCalled());
    expect(picker.launchCameraAsync).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ["images"] }));
  });

  it("with no photos or videos left today it shows the lock and does not open the camera", async () => {
    trips.fetchTrip.mockResolvedValue(tripDetail(0, 0));
    await openCapture();

    expect(await screen.findByText("Se terminó el rollo de hoy")).toBeVisible();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it("before the roll starts it says so and does not open the camera", async () => {
    const d = tripDetail(10, 3);
    trips.fetchTrip.mockResolvedValue({ ...d, trip: { ...d.trip, startsAt: Date.UTC(2099, 9, 29, 22, 0), endsAt: Date.UTC(2099, 10, 5) } });
    await openCapture();

    expect(await screen.findByText("Este rollo todavía no empezó")).toBeVisible();
    expect(screen.getByText("Arranca el 29 de octubre a las 19:00.")).toBeVisible();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it("waits for the saved active trip instead of deciding with the first one in the list", async () => {
    const OTHER = "22222222-2222-4222-8222-222222222222";
    const upcoming = tripDetail(10, 3);
    upcoming.trip = { ...upcoming.trip, id: OTHER, name: "Mendoza", startsAt: Date.UTC(2099, 9, 31, 22, 0), endsAt: Date.UTC(2099, 10, 5) };
    await signInAs({
      trips: [tripSummary(OTHER, "Mendoza", { role: "member" }), tripSummary(SUR, "Viaje al sur")],
      active: SUR,
    });
    // Both details are already cached, so only the saved-id read is async.
    queryClient.setQueryData(["trip", OTHER], upcoming, { updatedAt: Date.now() });
    queryClient.setQueryData(["trip", SUR], tripDetail(7, 2), { updatedAt: Date.now() });
    trips.fetchTrip.mockImplementation(async (id: string) => (id === OTHER ? upcoming : tripDetail(7, 2)));
    picker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null });
    await openCapture();

    await waitFor(() => expect(picker.launchCameraAsync).toHaveBeenCalled());
    expect(screen.queryByText("Este rollo todavía no empezó")).toBeNull();
  });

  it("after the roll ended it says when it is revealed and does not open the camera", async () => {
    const d = tripDetail(10, 3);
    trips.fetchTrip.mockResolvedValue({
      ...d,
      trip: { ...d.trip, startsAt: Date.now() - 9 * DAY, endsAt: Date.now() - DAY, revealAt: Date.UTC(2099, 0, 24, 14, 0) },
    });
    await openCapture();

    expect(await screen.findByText("Este rollo ya terminó")).toBeVisible();
    expect(screen.getByText("Se revela el 24 de enero a las 11:00.")).toBeVisible();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it("once revealed it says no more photos can be taken and does not open the camera", async () => {
    const d = tripDetail(10, 3);
    trips.fetchTrip.mockResolvedValue({ ...d, trip: { ...d.trip, endsAt: Date.now() - DAY, revealed: true } });
    await openCapture();

    expect(await screen.findByText("Este rollo ya se reveló")).toBeVisible();
    expect(screen.getByText("Ya no se pueden sacar fotos.")).toBeVisible();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it("with no signal it computes the quota from the trip's saved data", async () => {
    queryClient.setQueryData(["trip", SUR], tripDetail(0, 0), { updatedAt: Date.now() - 60_000 });
    trips.fetchTrip.mockRejectedValue(new Error("Sin conexión"));
    await openCapture();

    expect(await screen.findByText("Se terminó el rollo de hoy")).toBeVisible();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it("what is in the queue, not yet uploaded, also counts toward the quota", async () => {
    trips.fetchTrip.mockResolvedValue(tripDetail(1, 0));
    await queue.enqueue({
      id: "ya-sacada",
      tripId: SUR,
      type: "photo",
      takenAt: Date.now(),
      day: localDay(Date.now(), TZ),
      lat: null, lng: null, accuracyM: null, caption: null, durationS: null, width: null, height: null,
      sizeBytes: 1, originalUri: "x", thumbUri: "y", thumbhash: null,
    });
    await openCapture();

    expect(await screen.findByText("Se terminó el rollo de hoy")).toBeVisible();
  });

  it("after shooting it shows the preview to retake or send", async () => {
    picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [photo] });
    await openCapture();

    expect(await screen.findByRole("button", { name: "Mandar al rollo" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Repetir" })).toBeVisible();
    expect(screen.getByLabelText("Caption")).toBeVisible();
  });

  it("retaking discards the photo and reopens the camera", async () => {
    picker.launchCameraAsync.mockResolvedValueOnce({ canceled: false, assets: [photo] });
    picker.launchCameraAsync.mockResolvedValueOnce({ canceled: true, assets: null });
    await openCapture();

    await fireEvent.press(await screen.findByRole("button", { name: "Repetir" }));

    await waitFor(() => expect(picker.launchCameraAsync).toHaveBeenCalledTimes(2));
    expect(mediaMock.discard).toHaveBeenCalledWith(photo.uri);
  });

  it("sending saves it to the queue with time, location and caption, and goes back", async () => {
    picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [photo] });
    await openCapture();

    await fireEvent.changeText(await screen.findByLabelText("Caption"), "  el viento no perdona ");
    await fireEvent.press(screen.getByRole("button", { name: "Mandar al rollo" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    const [saved] = await queue.pending();
    expect(saved).toMatchObject({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tripId: SUR,
      type: "photo",
      day: localDay(Date.now(), TZ),
      lat: -49.33,
      lng: -72.89,
      accuracyM: 12,
      caption: "el viento no perdona",
      thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
    });
    expect(Math.abs(saved!.takenAt - Date.now())).toBeLessThan(60_000);
    expect(mediaMock.prepareMedia).toHaveBeenCalledWith(photo, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
      takenAt: saved!.takenAt,
      timeZone: TZ,
      location: { lat: -49.33, lng: -72.89, accuracyM: 12 },
      caption: "el viento no perdona",
      author: "Juani",
    });
  });

  it("waits for the location before preparing the photo, since the EXIF needs it", async () => {
    let resolveFix: (fix: { lat: number; lng: number; accuracyM: number }) => void = () => {};
    jest.mocked(startFix).mockReturnValueOnce(new Promise((resolve) => (resolveFix = resolve)));
    picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [photo] });
    await openCapture();
    const send = await screen.findByRole("button", { name: "Mandar al rollo" });
    mediaMock.prepareMedia.mockClear();
    let pressed: Promise<unknown> = Promise.resolve();
    await act(async () => {
      pressed = fireEvent.press(send); // send() waits for the fix: don't await it yet
    });
    expect(mediaMock.prepareMedia).not.toHaveBeenCalled();

    await act(async () => resolveFix({ lat: 1, lng: 2, accuracyM: 3 }));
    await pressed;
    await waitFor(() => expect(mediaMock.prepareMedia).toHaveBeenCalled());
    expect(mediaMock.prepareMedia.mock.calls[0]![2].location).toEqual({ lat: 1, lng: 2, accuracyM: 3 });
  });

  it("sending triggers the queue upload, with the photo already enqueued", async () => {
    picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [photo] });
    await openCapture();
    const send = await screen.findByRole("button", { name: "Mandar al rollo" });
    syncQueue.mockClear(); // the upload at app startup does not count
    let queuedWhenSyncing = 0;
    syncQueue.mockImplementation(async () => {
      queuedWhenSyncing = (await queue.pending()).length;
    });

    await fireEvent.press(send);

    await waitFor(() => expect(syncQueue).toHaveBeenCalledTimes(1));
    expect(queuedWhenSyncing).toBe(1);
  });
});
