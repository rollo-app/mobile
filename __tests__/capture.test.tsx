import { router } from "expo-router";
import { StyleSheet } from "react-native";
import { act, fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
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

jest.mock("expo-image-manipulator", () => {
  const ctx = { crop: jest.fn(), flip: jest.fn(), renderAsync: jest.fn(), saveAsync: jest.fn() };
  ctx.crop.mockReturnValue(ctx);
  ctx.flip.mockReturnValue(ctx);
  ctx.renderAsync.mockResolvedValue(ctx);
  return { ImageManipulator: { manipulate: jest.fn(() => ctx), __ctx: ctx }, SaveFormat: { JPEG: "jpeg" } };
});

const trips = jest.mocked(actions);
const manipulator = jest.requireMock("expo-image-manipulator").ImageManipulator as { manipulate: jest.Mock; __ctx: { crop: jest.Mock; flip: jest.Mock; saveAsync: jest.Mock } };
const files = jest.requireMock("expo-file-system").File as { deleted: number };
const mediaMock = jest.mocked(media);
const { getQueue } = jest.requireMock("@/features/capture/store") as { getQueue: jest.Mock };
const vision = jest.requireMock("react-native-vision-camera") as {
  __device: (overrides: Record<string, unknown>) => unknown;
  __devices: { back: unknown; front: unknown };
  __photo: (path: string, width: number, height: number, orientation?: string, isMirrored?: boolean) => { dispose: jest.Mock };
  __capturePhoto: jest.Mock;
  __focusTo: jest.Mock;
  __controller: { minZoom: number; maxZoom: number; setZoom: jest.Mock };
  __startZoomAnimation: jest.Mock;
  __granted: unknown;
  useCameraDevices: jest.Mock;
  useCameraPermission: jest.Mock;
  usePhotoOutput: jest.Mock;
};
const takePhoto = vision.__capturePhoto;
const { useCameraPermission } = vision;
const { syncQueue } = jest.requireMock("@/features/capture/sync") as { syncQueue: jest.Mock };

const SUR = "11111111-1111-4111-8111-111111111111";
const TZ = "America/Argentina/Buenos_Aires";
const DAY = 24 * 60 * 60 * 1000;


function tripDetail(photosLeft: number, mode: "daily" | "total" = "daily"): actions.TripDetail {
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
      photoLimitMode: mode,
      totalPhotoLimit: mode === "total" ? 20 : null,
      momentMode: "off",
      momentWindowStart: 540,
      momentWindowEnd: 1380,
    },
    me: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin", blockedByMe: false },
    members: [],
    today: { date: localDay(Date.now(), TZ), photosLeft, videosLeft: 0 },
    totalUploaded: 0,
  };
}

/** What the camera hands over for the default shot: a file:// uri, upright (the sensor's 4032×3024 held portrait). */
const photo = { uri: "file:///cache/Camera/IMG_1.jpg", width: 3024, height: 4032 };

let queue: Queue;

beforeEach(async () => {
  queue = await createQueue(memoryDb());
  getQueue.mockResolvedValue(queue);
  takePhoto.mockReset();
  takePhoto.mockImplementation(async () => vision.__photo("/cache/Camera/IMG_1.jpg", 4032, 3024));
  vision.useCameraDevices.mockReset();
  vision.useCameraDevices.mockReturnValue([vision.__devices.back, vision.__devices.front]);
  vision.__focusTo.mockClear();
  vision.__controller.maxZoom = 123.75;
  vision.__controller.setZoom.mockClear();
  vision.__startZoomAnimation.mockClear();
  vision.usePhotoOutput.mock.results.forEach((r) => r.value.prepareSettings.mockClear());
  manipulator.manipulate.mockClear();
  manipulator.__ctx.flip.mockClear();
  manipulator.__ctx.crop.mockClear();
  syncQueue.mockReset();
  syncQueue.mockResolvedValue(undefined);
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur", { role: "admin" })] });
  trips.fetchTrip.mockResolvedValue(tripDetail(7));
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
  await renderRouter(routes, { initialUrl: "/roll" });
  // No testRouter.push: it asserts the route and the capture may return right away.
  await act(async () => router.push("/capture"));
}

/** The session started: VisionCamera fires `onStarted` once the outputs are configured. */
async function startSession(testID = "camera-back") {
  const camera = await screen.findByTestId(testID);
  await act(async () => camera.props.onStarted());
}

async function shoot() {
  await fireEvent.press(await screen.findByRole("button", { name: "Sacar foto" }));
}

describe("Capture", () => {
  it("opens the in-app camera on the back one and Cerrar goes back without queueing anything", async () => {
    await openCapture();

    expect(await screen.findByTestId("camera-back")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Cerrar" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(await queue.pending()).toHaveLength(0);
    expect(takePhoto).not.toHaveBeenCalled();
  });

  it("takes the picture at full quality and goes straight to the caption: no Repetir, no Usar foto, no Cerrar", async () => {
    await openCapture();
    await shoot();

    expect(await screen.findByLabelText("Caption")).toBeVisible();
    expect(vision.usePhotoOutput).toHaveBeenLastCalledWith(expect.objectContaining({ quality: 1, qualityPrioritization: "quality", containerFormat: "jpeg" }));
    expect(screen.queryByRole("button", { name: "Repetir" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Usar foto" })).toBeNull();
    expect(screen.queryByTestId("camera-back")).toBeNull();
  });

  it("the camera can be flipped, and a front photo is prepared like any other (no 1080 limit)", async () => {
    await openCapture();
    await fireEvent.press(await screen.findByRole("button", { name: "Dar vuelta la cámara" }));
    expect(await screen.findByTestId("camera-front")).toBeVisible();
    await shoot();
    await fireEvent.press(await screen.findByRole("button", { name: "Mandar al rollo" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(mediaMock.prepareMedia.mock.calls[0]![3]).toBeUndefined();
  });

  it("shows the preview in a full-width 3:4 frame, with the pinch area on the frame and the controls outside it", async () => {
    await openCapture();
    const frame = await screen.findByTestId("camera-frame");
    expect(StyleSheet.flatten(frame.props.style)).toMatchObject({ aspectRatio: 3 / 4, width: expect.any(Number) });
    expect(within(frame).getByTestId("camera-back")).toBeTruthy();
    expect(within(frame).getByTestId("camera-pinch")).toBeTruthy();
    expect(within(frame).queryByRole("button", { name: "Sacar foto" })).toBeNull();
    expect(within(frame).queryByRole("button", { name: /Flash/ })).toBeNull();
  });

  it("keeps a 4:3 photo as it came (no re-encoding), upright and as a file:// uri", async () => {
    await openCapture();
    await shoot();
    await screen.findByLabelText("Caption");
    expect(manipulator.manipulate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Mandar al rollo" }));
    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(mediaMock.prepareMedia.mock.lastCall![0]).toEqual(photo);
    expect(files.deleted).toBe(0);
  });

  it("frees the native photo once it is on disk", async () => {
    const shot = vision.__photo("/cache/Camera/IMG_1.jpg", 4032, 3024);
    takePhoto.mockResolvedValueOnce(shot);
    await openCapture();
    await shoot();
    await screen.findByLabelText("Caption");
    expect(shot.dispose).toHaveBeenCalledTimes(1);
  });

  it("a front photo comes out unmirrored like the iPhone's camera (the preview stays mirrored), and the mirrored file is deleted", async () => {
    takePhoto.mockImplementation(async () => vision.__photo("/cache/Camera/selfie.jpg", 4032, 3024, "leftMirrored" as never, true));
    manipulator.__ctx.saveAsync.mockResolvedValue({ uri: "file:///cache/Manipulated/selfie.jpg", width: 3024, height: 4032 });
    await openCapture();
    await fireEvent.press(await screen.findByRole("button", { name: "Dar vuelta la cámara" }));
    expect((await screen.findByTestId("camera-front")).props.mirrorMode).toBe("auto");
    await shoot();
    await screen.findByLabelText("Caption");
    expect(manipulator.manipulate).toHaveBeenCalledWith("file:///cache/Camera/selfie.jpg");
    expect(manipulator.__ctx.flip).toHaveBeenCalledWith("horizontal");
    expect(manipulator.__ctx.crop).not.toHaveBeenCalled();
    expect(files.deleted).toBe(1);
    await fireEvent.press(screen.getByRole("button", { name: "Mandar al rollo" }));
    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(mediaMock.prepareMedia.mock.lastCall![0]).toEqual({ uri: "file:///cache/Manipulated/selfie.jpg", width: 3024, height: 4032 });
  });

  it("asks for the device's largest 4:3 photo up to 24 MP (not 48) and biases the session to it", async () => {
    await openCapture();
    const camera = await screen.findByTestId("camera-back");
    expect(vision.usePhotoOutput).toHaveBeenLastCalledWith(expect.objectContaining({ targetResolution: { width: 4284, height: 5712 } }));
    const output = vision.usePhotoOutput.mock.results.at(-1)!.value;
    expect(camera.props.outputs).toEqual([output]);
    expect(camera.props.constraints).toEqual([{ resolutionBias: output }]);
    expect(camera.props.isActive).toBe(true);
  });

  it("center-crops a photo that is not 4:3 (never stretches it) before the caption", async () => {
    takePhoto.mockImplementation(async () => vision.__photo("/cache/Camera/tall.jpg", 2250, 4000, "up"));
    manipulator.__ctx.saveAsync.mockResolvedValue({ uri: "file:///cache/Manipulated/tall.jpg", width: 2250, height: 3000 });
    await openCapture();
    await shoot();
    await screen.findByLabelText("Caption");
    expect(manipulator.manipulate).toHaveBeenCalledWith("file:///cache/Camera/tall.jpg");
    expect(manipulator.__ctx.crop).toHaveBeenCalledWith({ originX: 0, originY: 500, width: 2250, height: 3000 });
    expect(manipulator.__ctx.flip).not.toHaveBeenCalled();
    expect(files.deleted).toBe(1);
    await fireEvent.press(screen.getByRole("button", { name: "Mandar al rollo" }));
    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(mediaMock.prepareMedia.mock.lastCall![0]).toMatchObject({ uri: "file:///cache/Manipulated/tall.jpg", width: 2250, height: 3000 });
  });

  it("the flash button cycles automático, prendido, apagado and the photo is taken with that flash", async () => {
    await openCapture();
    await fireEvent.press(await screen.findByRole("button", { name: "Flash automático" }));
    await fireEvent.press(screen.getByRole("button", { name: "Flash prendido" }));
    await fireEvent.press(screen.getByRole("button", { name: "Flash apagado" }));
    expect(screen.getByRole("button", { name: "Flash automático" })).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Flash automático" }));
    await shoot();
    await screen.findByLabelText("Caption");
    expect(takePhoto).toHaveBeenCalledWith(expect.objectContaining({ flashMode: "on" }), {});
  });

  it("warms up the capture once the session is running, and again when the flash changes", async () => {
    await openCapture();
    const output = vision.usePhotoOutput.mock.results.at(-1)!.value;
    await screen.findByTestId("camera-back");
    expect(output.prepareSettings).not.toHaveBeenCalled();
    await startSession();
    expect(output.prepareSettings).toHaveBeenLastCalledWith([{ flashMode: "auto", enableDistortionCorrection: true }]);
    await fireEvent.press(screen.getByRole("button", { name: "Flash automático" }));
    expect(output.prepareSettings).toHaveBeenLastCalledWith([{ flashMode: "on", enableDistortionCorrection: true }]);
  });

  it("camera errors are logged once as a warning, never as an error screen", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const error = jest.spyOn(console, "error");
    try {
      await openCapture();
      const camera = await screen.findByTestId("camera-back");
      error.mockClear();
      camera.props.onError(new Error("zoom out of range"));
      camera.props.onError(new Error("zoom out of range"));
      expect(warn).toHaveBeenCalledTimes(1);
      expect(error).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });

  it("opens at 1x (the wide lens, not the ultra-wide) with the iPhone's chips: 0,5 · 1× · 2 · 3", async () => {
    await openCapture();
    expect((await screen.findByTestId("camera-back")).props.zoom).toBe(2);
    const chips = within(screen.getByTestId("zoom-chips")).getAllByRole("button");
    expect(chips.map((c) => c.props.accessibilityLabel)).toEqual(["Zoom 0,5×", "Zoom 1×", "Zoom 2×", "Zoom 3×"]);
    expect(within(screen.getByTestId("zoom-chips")).getByText("1×")).toBeVisible();
    expect(within(screen.getByTestId("zoom-chips")).getByText("0,5")).toBeVisible();
    expect(screen.getByRole("button", { name: "Zoom 1×" })).toBeSelected();
  });

  it("a chip ramps smoothly to that lens: 0,5 is the device's minimum and 3 is the telephoto", async () => {
    await openCapture();
    await startSession();
    await fireEvent.press(screen.getByRole("button", { name: "Zoom 0,5×" }));
    expect(vision.__startZoomAnimation).toHaveBeenLastCalledWith(1, expect.any(Number));
    expect(screen.getByRole("button", { name: "Zoom 0,5×" })).toBeSelected();
    await fireEvent.press(screen.getByRole("button", { name: "Zoom 3×" }));
    expect(vision.__startZoomAnimation).toHaveBeenLastCalledWith(6, expect.any(Number));
    expect(screen.getByRole("button", { name: "Zoom 3×" })).toBeSelected();
    expect(vision.__controller.setZoom).not.toHaveBeenCalled();
  });

  it("without an ultra-wide there is no 0,5 and 1x is the minimum; a telephoto shows as its own chip", async () => {
    vision.useCameraDevices.mockReturnValue([
      vision.__device({ id: "dual", type: "dual", zoomLensSwitchFactors: [3], physicalDevices: [{ type: "wide-angle" }, { type: "telephoto" }] }),
    ]);
    await openCapture();
    expect((await screen.findByTestId("camera-back")).props.zoom).toBe(1);
    const chips = within(screen.getByTestId("zoom-chips")).getAllByRole("button");
    expect(chips.map((c) => c.props.accessibilityLabel)).toEqual(["Zoom 1×", "Zoom 2×", "Zoom 3×"]);
  });

  it("the front camera starts at 1x with no chips, and flipping back starts over at 1x", async () => {
    await openCapture();
    await startSession();
    await fireEvent.press(screen.getByRole("button", { name: "Zoom 3×" }));
    await fireEvent.press(screen.getByRole("button", { name: "Dar vuelta la cámara" }));
    expect((await screen.findByTestId("camera-front")).props.zoom).toBe(1);
    expect(screen.queryByTestId("zoom-chips")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Dar vuelta la cámara" }));
    expect((await screen.findByTestId("camera-back")).props.zoom).toBe(2);
  });

  it("pinching zooms continuously and the active chip shows the live value", async () => {
    await openCapture();
    await startSession();
    const area = screen.getByTestId("camera-pinch");
    const touches = (gap: number) => ({ nativeEvent: { touches: [{ pageX: 100, pageY: 100 }, { pageX: 100 + gap, pageY: 100 }] } });

    await fireEvent(area, "responderGrant", touches(100));
    await fireEvent(area, "responderMove", touches(140));
    expect(vision.__controller.setZoom.mock.lastCall![0]).toBeCloseTo(2.8);
    expect(within(screen.getByTestId("zoom-chips")).getByText("1,4×")).toBeVisible();
    expect(screen.getByRole("button", { name: "Zoom 1×" })).toBeSelected();
    await fireEvent(area, "responderMove", touches(10));
    expect(vision.__controller.setZoom).toHaveBeenLastCalledWith(1);
    await fireEvent(area, "responderMove", touches(10000));
    expect(vision.__controller.setZoom).toHaveBeenLastCalledWith(30);
  });

  it("the pinch never goes past the running format's real maximum", async () => {
    vision.__controller.maxZoom = 12;
    await openCapture();
    await startSession();
    const area = screen.getByTestId("camera-pinch");
    const touches = (gap: number) => ({ nativeEvent: { touches: [{ pageX: 100, pageY: 100 }, { pageX: 100 + gap, pageY: 100 }] } });
    await fireEvent(area, "responderGrant", touches(100));
    await fireEvent(area, "responderMove", touches(10000));
    expect(vision.__controller.setZoom).toHaveBeenLastCalledWith(12);
  });

  it("a new two-finger gesture after lifting a finger starts from the current zoom, with no jump", async () => {
    await openCapture();
    await startSession();
    const area = screen.getByTestId("camera-pinch");
    const touches = (gap: number) => ({ nativeEvent: { touches: [{ pageX: 100, pageY: 100 }, { pageX: 100 + gap, pageY: 100 }] } });
    await fireEvent(area, "responderGrant", touches(100));
    await fireEvent(area, "responderMove", touches(200));
    const before = vision.__controller.setZoom.mock.lastCall![0] as number;

    await fireEvent(area, "responderMove", { nativeEvent: { touches: [{ pageX: 100, pageY: 100 }] } });
    await fireEvent(area, "responderMove", touches(400)); // second finger lands again, far apart
    expect(vision.__controller.setZoom).toHaveBeenLastCalledWith(before);
  });

  it("a tap on the frame focuses there", async () => {
    await openCapture();
    const area = await screen.findByTestId("camera-pinch");
    const tap = { nativeEvent: { touches: [{ pageX: 50, pageY: 80 }], locationX: 40, locationY: 60, pageX: 50, pageY: 80 } };
    await fireEvent(area, "responderGrant", tap);
    await fireEvent(area, "responderRelease", { nativeEvent: { touches: [], locationX: 40, locationY: 60, pageX: 50, pageY: 80 } });
    expect(vision.__focusTo).toHaveBeenCalledWith({ x: 40, y: 60 });
  });

  it("does not ask for camera permission over the lock", async () => {
    const requestPermission = jest.fn();
    useCameraPermission.mockReturnValue({ status: "not-determined", hasPermission: false, canRequestPermission: true, requestPermission });
    trips.fetchTrip.mockResolvedValue(tripDetail(0));
    try {
      await openCapture();
      expect(await screen.findByText("Se terminó el rollo de hoy")).toBeVisible();
      expect(requestPermission).not.toHaveBeenCalled();
    } finally {
      useCameraPermission.mockReset();
      useCameraPermission.mockReturnValue(vision.__granted);
    }
  });

  it("without camera permission it shows the message with a way to open Ajustes and no camera", async () => {
    useCameraPermission.mockReturnValue({ status: "denied", hasPermission: false, canRequestPermission: false, requestPermission: jest.fn() });
    try {
      await openCapture();
      expect(await screen.findByText("Rollo necesita la cámara")).toBeVisible();
      expect(screen.getByRole("button", { name: "Abrir Ajustes" })).toBeVisible();
      expect(screen.queryByTestId("camera-back")).toBeNull();
    } finally {
      useCameraPermission.mockReset();
      useCameraPermission.mockReturnValue(vision.__granted);
    }
  });

  it("starts the location fix when the camera opens, before any photo", async () => {
    jest.mocked(startFix).mockClear();
    await openCapture();
    expect(await screen.findByTestId("camera-back")).toBeVisible();
    expect(startFix).toHaveBeenCalledTimes(1);
  });

  it("when taking the picture fails it shows an inline error and lets the user retry", async () => {
    takePhoto.mockRejectedValueOnce(new Error("camera busy"));
    await openCapture();
    await shoot();
    expect(await screen.findByText("No se pudo sacar la foto. Probá de nuevo.")).toBeVisible();
    await shoot();
    expect(await screen.findByRole("button", { name: "Mandar al rollo" })).toBeVisible();
  });
  it("with no photos left today it shows the lock and does not open the camera", async () => {
    trips.fetchTrip.mockResolvedValue(tripDetail(0));
    await openCapture();

    expect(await screen.findByText("Se terminó el rollo de hoy")).toBeVisible();
    expect(screen.getByText("Mañana tenés 10 fotos nuevas.")).toBeVisible();
    expect(screen.queryByTestId("camera-back")).toBeNull();
  });

  it("with a total limit and no photos left it says you used all of the rollo's", async () => {
    trips.fetchTrip.mockResolvedValue(tripDetail(0, "total"));
    await openCapture();

    expect(await screen.findByText("Ya usaste todas tus fotos del rollo")).toBeVisible();
    expect(screen.queryByText("Se terminó el rollo de hoy")).toBeNull();
    expect(screen.queryByTestId("camera-back")).toBeNull();
  });

  it("with a total limit, what is in the queue from any day counts toward what is left", async () => {
    trips.fetchTrip.mockResolvedValue(tripDetail(1, "total"));
    await queue.enqueue({
      id: "de-ayer",
      tripId: SUR,
      type: "photo",
      takenAt: Date.now() - DAY,
      day: localDay(Date.now() - DAY, TZ),
      lat: null, lng: null, accuracyM: null, caption: null, durationS: null, width: null, height: null,
      sizeBytes: 1, originalUri: "x", thumbUri: "y", thumbhash: null,
    });
    await openCapture();

    expect(await screen.findByText("Ya usaste todas tus fotos del rollo")).toBeVisible();
  });

  it("with a daily limit, yesterday's queue does not count toward today's", async () => {
    trips.fetchTrip.mockResolvedValue(tripDetail(1));
    await queue.enqueue({
      id: "de-ayer",
      tripId: SUR,
      type: "photo",
      takenAt: Date.now() - DAY,
      day: localDay(Date.now() - DAY, TZ),
      lat: null, lng: null, accuracyM: null, caption: null, durationS: null, width: null, height: null,
      sizeBytes: 1, originalUri: "x", thumbUri: "y", thumbhash: null,
    });
    await openCapture();

    expect(await screen.findByTestId("camera-back")).toBeVisible();
  });

  it("before the roll starts it says so and does not open the camera", async () => {
    const d = tripDetail(10);
    trips.fetchTrip.mockResolvedValue({ ...d, trip: { ...d.trip, startsAt: Date.UTC(2099, 9, 29, 22, 0), endsAt: Date.UTC(2099, 10, 5) } });
    await openCapture();

    expect(await screen.findByText("Este rollo todavía no empezó")).toBeVisible();
    expect(screen.getByText("Arranca el 29 de octubre a las 19:00.")).toBeVisible();
    expect(screen.queryByTestId("camera-back")).toBeNull();
  });

  it("waits for the saved active trip instead of deciding with the first one in the list", async () => {
    const OTHER = "22222222-2222-4222-8222-222222222222";
    const upcoming = tripDetail(10);
    upcoming.trip = { ...upcoming.trip, id: OTHER, name: "Mendoza", startsAt: Date.UTC(2099, 9, 31, 22, 0), endsAt: Date.UTC(2099, 10, 5) };
    await signInAs({
      trips: [tripSummary(OTHER, "Mendoza", { role: "member" }), tripSummary(SUR, "Viaje al sur")],
      active: SUR,
    });
    // Both details are already cached, so only the saved-id read is async.
    queryClient.setQueryData(["trip", OTHER], upcoming, { updatedAt: Date.now() });
    queryClient.setQueryData(["trip", SUR], tripDetail(7), { updatedAt: Date.now() });
    trips.fetchTrip.mockImplementation(async (id: string) => (id === OTHER ? upcoming : tripDetail(7)));
    await openCapture();

    expect(await screen.findByTestId("camera-back")).toBeVisible();
    expect(screen.queryByText("Este rollo todavía no empezó")).toBeNull();
  });

  it("after the roll ended it says when it is revealed and does not open the camera", async () => {
    const d = tripDetail(10);
    trips.fetchTrip.mockResolvedValue({
      ...d,
      trip: { ...d.trip, startsAt: Date.now() - 9 * DAY, endsAt: Date.now() - DAY, revealAt: Date.UTC(2099, 0, 24, 14, 0) },
    });
    await openCapture();

    expect(await screen.findByText("Este rollo ya terminó")).toBeVisible();
    expect(screen.getByText("Se revela el 24 de enero a las 11:00.")).toBeVisible();
    expect(screen.queryByTestId("camera-back")).toBeNull();
  });

  it("once revealed it says no more photos can be taken and does not open the camera", async () => {
    const d = tripDetail(10);
    trips.fetchTrip.mockResolvedValue({ ...d, trip: { ...d.trip, endsAt: Date.now() - DAY, revealed: true } });
    await openCapture();

    expect(await screen.findByText("Este rollo ya se reveló")).toBeVisible();
    expect(screen.getByText("Ya no se pueden sacar fotos.")).toBeVisible();
    expect(screen.queryByTestId("camera-back")).toBeNull();
  });

  it("with no signal it computes the quota from the trip's saved data", async () => {
    queryClient.setQueryData(["trip", SUR], tripDetail(0), { updatedAt: Date.now() - 60_000 });
    trips.fetchTrip.mockRejectedValue(new Error("Sin conexión"));
    await openCapture();

    expect(await screen.findByText("Se terminó el rollo de hoy")).toBeVisible();
    expect(screen.queryByTestId("camera-back")).toBeNull();
  });

  it("what is in the queue, not yet uploaded, also counts toward the quota", async () => {
    trips.fetchTrip.mockResolvedValue(tripDetail(1));
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

  it("after shooting it shows a heavily blurred photo with a caption and no way out but sending it", async () => {
    await openCapture();
    await shoot();

    expect(await screen.findByRole("button", { name: "Mandar al rollo" })).toBeVisible();
    expect(screen.getByLabelText("Caption")).toBeVisible();
    const blurred = screen.container.queryAll((node) => node.props.blurRadius >= 40);
    expect(blurred.length).toBeGreaterThan(0);
    // "The shot is the shot": no retake and no cancel, so you can't discard it.
    expect(screen.queryByRole("button", { name: "Repetir" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
        expect(mediaMock.discard).not.toHaveBeenCalled();
  });

  it("sending saves it to the queue with time, location and caption, and goes back", async () => {
    await openCapture();
    await shoot();

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
    await openCapture();
    await shoot();
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
    await openCapture();
    await shoot();
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
