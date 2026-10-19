import { router } from "expo-router";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as ImagePicker from "expo-image-picker";
import * as actions from "@/features/trips/actions";
import * as media from "@/features/capture/media";
import { localDay } from "@/features/capture/quota";
import { createQueue, type Queue } from "@/features/capture/queue";
import { saveSession } from "@/storage/trips";
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
    me: { id: "m1", name: "Juani", role: "admin" },
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
  await saveSession({ tripId: SUR, tripName: "Viaje al sur", joinCode: "HUB5FT", memberId: "m1", memberName: "Juani", role: "admin", token: "t" });
  trips.fetchTrip.mockResolvedValue(tripDetail(7, 2));
  mediaMock.prepareMedia.mockResolvedValue({
    originalUri: "file:///docs/pending/a/original.jpg",
    thumbUri: "file:///docs/pending/a/thumb.jpg",
    width: 4000,
    height: 3000,
    sizeBytes: 2_500_000,
    durationS: null,
    thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
  });
});

async function openCapture() {
  await renderRouter(routes, { initialUrl: "/rollo" });
  // Sin testRouter.push: ese asserta la ruta y la captura puede volver enseguida.
  await act(async () => router.push("/capture"));
}

describe("Captura", () => {
  it("abre la cámara del sistema con foto y video, y si cancelás vuelve", async () => {
    picker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null });
    await openCapture();

    await waitFor(() => expect(screen).toHavePathname("/rollo"));
    expect(picker.launchCameraAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ["images", "videos"], videoMaxDuration: 15 }),
    );
  });

  it("si no te quedan videos hoy abre la cámara solo para fotos", async () => {
    trips.fetchTrip.mockResolvedValue(tripDetail(7, 0));
    picker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null });
    await openCapture();

    await waitFor(() => expect(picker.launchCameraAsync).toHaveBeenCalled());
    expect(picker.launchCameraAsync).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ["images"] }));
  });

  it("sin fotos ni videos hoy muestra el candado y no abre la cámara", async () => {
    trips.fetchTrip.mockResolvedValue(tripDetail(0, 0));
    await openCapture();

    expect(await screen.findByText("Se terminó el rollo de hoy")).toBeVisible();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it("lo que está en la cola sin subir también cuenta para el cupo", async () => {
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

  it("después de sacar muestra el preview para repetir o mandar", async () => {
    picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [photo] });
    await openCapture();

    expect(await screen.findByRole("button", { name: "Mandar al rollo" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Repetir" })).toBeVisible();
    expect(screen.getByLabelText("Caption")).toBeVisible();
  });

  it("repetir descarta la foto y vuelve a abrir la cámara", async () => {
    picker.launchCameraAsync.mockResolvedValueOnce({ canceled: false, assets: [photo] });
    picker.launchCameraAsync.mockResolvedValueOnce({ canceled: true, assets: null });
    await openCapture();

    await fireEvent.press(await screen.findByRole("button", { name: "Repetir" }));

    await waitFor(() => expect(picker.launchCameraAsync).toHaveBeenCalledTimes(2));
    expect(mediaMock.discard).toHaveBeenCalledWith(photo.uri);
  });

  it("mandar la guarda en la cola con hora, ubicación y caption, y vuelve", async () => {
    picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [photo] });
    await openCapture();

    await fireEvent.changeText(await screen.findByLabelText("Caption"), "  el viento no perdona ");
    await fireEvent.press(screen.getByRole("button", { name: "Mandar al rollo" }));

    await waitFor(() => expect(screen).toHavePathname("/rollo"));
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
    expect(mediaMock.prepareMedia).toHaveBeenCalledWith(photo, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("al mandar dispara la subida de la cola, ya con la foto encolada", async () => {
    picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [photo] });
    await openCapture();
    const send = await screen.findByRole("button", { name: "Mandar al rollo" });
    syncQueue.mockClear(); // la subida del arranque de la app no cuenta
    let queuedWhenSyncing = 0;
    syncQueue.mockImplementation(async () => {
      queuedWhenSyncing = (await queue.pending()).length;
    });

    await fireEvent.press(send);

    await waitFor(() => expect(syncQueue).toHaveBeenCalledTimes(1));
    expect(queuedWhenSyncing).toBe(1);
  });
});
