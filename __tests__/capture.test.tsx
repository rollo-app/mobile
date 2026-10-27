import { AccessibilityInfo, Alert } from "react-native";
import { router } from "expo-router";
import { StyleSheet } from "react-native";
import { act, fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import "@/test/reanimated";
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
  selectionAsync: jest.fn(async () => {}),
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
  __controller: { minZoom: number; maxZoom: number; zoom: number; displayableZoomFactor: number; setZoom: jest.Mock };
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
  vision.__controller.zoom = 1;
  vision.__controller.displayableZoomFactor = 1;
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

  it("a front photo the camera didn't mirror is mirrored, so it comes out as the preview showed it", async () => {
    takePhoto.mockImplementation(async () => vision.__photo("/cache/Camera/selfie.jpg", 4032, 3024, "right", false));
    manipulator.__ctx.saveAsync.mockResolvedValue({ uri: "file:///cache/Manipulated/selfie.jpg", width: 3024, height: 4032 });
    await openCapture();
    await fireEvent.press(await screen.findByRole("button", { name: "Dar vuelta la cámara" }));
    await screen.findByTestId("camera-front");
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

  it("a back photo is never mirrored", async () => {
    await openCapture();
    await shoot();
    await screen.findByLabelText("Caption");
    expect(manipulator.__ctx.flip).not.toHaveBeenCalled();
  });

  it("a front photo the camera already mirrored is kept as is, as the preview showed it", async () => {
    takePhoto.mockImplementation(async () => vision.__photo("/cache/Camera/selfie.jpg", 4032, 3024, "left", true));
    await openCapture();
    await fireEvent.press(await screen.findByRole("button", { name: "Dar vuelta la cámara" }));
    expect((await screen.findByTestId("camera-front")).props.mirrorMode).toBe("auto");
    await shoot();
    await screen.findByLabelText("Caption");
    expect(manipulator.manipulate).not.toHaveBeenCalled();
    expect(manipulator.__ctx.flip).not.toHaveBeenCalled();
    expect(files.deleted).toBe(0);
    await fireEvent.press(screen.getByRole("button", { name: "Mandar al rollo" }));
    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(mediaMock.prepareMedia.mock.lastCall![0]).toEqual({ uri: "file:///cache/Camera/selfie.jpg", width: 3024, height: 4032 });
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

  // VisionCamera sets `isAutoContentAwareDistortionCorrectionEnabled` per shot without enabling it on the output:
  // AVFoundation throws inside capturePhoto and the app crashes. Never ask for it.
  it("never asks for distortion correction on a shot (it crashes the native capture)", async () => {
    await openCapture();
    await shoot();
    await screen.findByLabelText("Caption");
    expect(takePhoto.mock.calls.at(-1)![0]).not.toHaveProperty("enableDistortionCorrection");
  });

  it("warms up the capture once the session is running, and again when the flash changes", async () => {
    await openCapture();
    const output = vision.usePhotoOutput.mock.results.at(-1)!.value;
    await screen.findByTestId("camera-back");
    expect(output.prepareSettings).not.toHaveBeenCalled();
    await startSession();
    expect(output.prepareSettings).toHaveBeenLastCalledWith([{ flashMode: "auto" }]);
    await fireEvent.press(screen.getByRole("button", { name: "Flash automático" }));
    expect(output.prepareSettings).toHaveBeenLastCalledWith([{ flashMode: "on" }]);
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

  it("the front camera starts at its 1x crop (1,25) with no chips, and flipping back starts over at 1x", async () => {
    await openCapture();
    await startSession();
    await fireEvent.press(screen.getByRole("button", { name: "Zoom 3×" }));
    await fireEvent.press(screen.getByRole("button", { name: "Dar vuelta la cámara" }));
    expect((await screen.findByTestId("camera-front")).props.zoom).toBe(1.25);
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
    expect(vision.__focusTo).toHaveBeenCalledWith({ x: 40, y: 60 }, { modes: ["AF", "AE", "AWB"], autoResetAfter: null });
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

  it("after shooting it shows a heavily blurred photo with a caption, and no retake", async () => {
    await openCapture();
    await shoot();

    expect(await screen.findByRole("button", { name: "Mandar al rollo" })).toBeVisible();
    expect(screen.getByLabelText("Caption")).toBeVisible();
    const blurred = screen.container.queryAll((node) => node.props.blurRadius >= 40);
    expect(blurred.length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Repetir" })).toBeNull();
  });

  it("the X asks to discard the photo; confirming deletes it and closes without queueing", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    try {
      await openCapture();
      await shoot();

      await fireEvent.press(await screen.findByRole("button", { name: "Descartar foto" }));
      const [title, , buttons] = alert.mock.calls.at(-1)!;
      expect(title).toBe("¿Descartar la foto?");
      expect(mediaMock.discard).not.toHaveBeenCalled();
      await act(async () => buttons!.find((b) => b.text === "Descartar")!.onPress!());

      expect(mediaMock.discard).toHaveBeenCalled();
      await waitFor(() => expect(screen).toHavePathname("/roll"));
      expect(await queue.pending()).toEqual([]);
    } finally {
      alert.mockRestore();
    }
  });

  it("cancelling the discard keeps the photo and the caption", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    try {
      mediaMock.discard.mockClear();
      await openCapture();
      await shoot();
      await fireEvent.changeText(await screen.findByLabelText("Caption"), "hola");

      await fireEvent.press(screen.getByRole("button", { name: "Descartar foto" }));
      const [, , buttons] = alert.mock.calls.at(-1)!;
      await act(async () => buttons!.find((b) => b.text === "Cancelar")?.onPress?.());

      expect(mediaMock.discard).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Caption").props.value).toBe("hola");
    } finally {
      alert.mockRestore();
    }
  });

  it("after sending, the photo leaves into the roll first (haptic at once), and only then the capture closes", async () => {
    const Haptics = jest.requireMock("expo-haptics") as { notificationAsync: jest.Mock };
    Haptics.notificationAsync.mockClear();
    await openCapture();
    await shoot();
    await fireEvent.press(await screen.findByRole("button", { name: "Mandar al rollo" }));

    await waitFor(() => expect(Haptics.notificationAsync).toHaveBeenCalledWith("success"));
    expect(screen).toHavePathname("/capture");
    expect(screen.getByRole("button", { name: "Mandar al rollo" })).toBeDisabled();
    await waitFor(() => expect(screen).toHavePathname("/roll"));
  });

  it.each([
    [false, { opacity: 0, transform: [{ translateY: 24 }, { scale: 0.92 }] }],
    [true, { opacity: 0, transform: [{ translateY: 0 }, { scale: 1 }] }],
  ])("the sent photo drops and shrinks as it fades, or only fades with Reduce Motion (on: %s)", async (reduced, end) => {
    const spy = jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(reduced);
    try {
      await openCapture();
      await shoot();
      await fireEvent.press(await screen.findByRole("button", { name: "Mandar al rollo" }));

      await waitFor(() => expect(StyleSheet.flatten(screen.getByTestId("sent-photo").props.style)).toMatchObject(end));
      await waitFor(() => expect(screen).toHavePathname("/roll"));
    } finally {
      // Not mockRestore: it's React Native's own jest.fn, and restoring would leave it returning undefined.
      spy.mockResolvedValue(false);
    }
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

describe("Camera extras (like the iPhone's camera)", () => {
  const SecureStore = jest.requireMock("expo-secure-store") as { getItemAsync: jest.Mock; setItemAsync: jest.Mock };
  const Haptics = jest.requireMock("expo-haptics") as { selectionAsync: jest.Mock };
  const at = (x: number, y: number) => ({ nativeEvent: { touches: [{ pageX: x + 10, pageY: y + 20 }], locationX: x, locationY: y, pageX: x + 10, pageY: y + 20 } });
  const lifted = (x: number, y: number) => ({ nativeEvent: { touches: [], locationX: x, locationY: y, pageX: x + 10, pageY: y + 20 } });

  async function tap(x: number, y: number) {
    const area = screen.getByTestId("camera-pinch");
    await fireEvent(area, "responderGrant", at(x, y));
    await fireEvent(area, "responderRelease", lifted(x, y));
  }

  /** One finger from (x, y) moved `dy` points down (negative = up), then lifted. */
  async function drag(x: number, y: number, dy: number) {
    const area = screen.getByTestId("camera-pinch");
    await fireEvent(area, "responderGrant", at(x, y));
    await fireEvent(area, "responderMove", at(x, y + dy));
    await fireEvent(area, "responderRelease", lifted(x, y + dy));
  }

  const exposure = (testID = "camera-back") => screen.getByTestId(testID).props.exposure as number | undefined;

  describe("Ampliar encuadre (front camera)", () => {
    it("on a front camera whose 1x is a crop, it opens at 1x and the button ramps to the widest framing and back", async () => {
      vision.__controller.displayableZoomFactor = 0.8; // raw 1 shows as 0,8×: 1× is raw 1,25
      await openCapture();
      await fireEvent.press(await screen.findByRole("button", { name: "Dar vuelta la cámara" }));
      await startSession("camera-front");
      expect(screen.getByTestId("camera-front").props.zoom).toBe(1.25);
      expect(screen.queryByTestId("zoom-chips")).toBeNull();

      await fireEvent.press(screen.getByRole("button", { name: "Ampliar encuadre" }));
      expect(vision.__startZoomAnimation).toHaveBeenLastCalledWith(1, expect.any(Number));
      await fireEvent.press(screen.getByRole("button", { name: "Reducir encuadre" }));
      expect(vision.__startZoomAnimation).toHaveBeenLastCalledWith(1.25, expect.any(Number));
      expect(screen.getByRole("button", { name: "Ampliar encuadre" })).toBeVisible();
    });

    it("shows on the front even when the device reports no multiplier (iPhone 15 Pro Max), never on the back", async () => {
      await openCapture();
      await startSession();
      expect(screen.queryByRole("button", { name: "Ampliar encuadre" })).toBeNull();
      await fireEvent.press(screen.getByRole("button", { name: "Dar vuelta la cámara" }));
      await startSession("camera-front");
      expect(await screen.findByRole("button", { name: "Ampliar encuadre" })).toBeTruthy();
    });
  });

  describe("exposure", () => {
    it("a tap meters focus and exposure there and shows the focus square with the exposure control", async () => {
      await openCapture();
      await startSession();
      expect(screen.queryByTestId("focus-square")).toBeNull();
      await tap(40, 60);
      expect(vision.__focusTo).toHaveBeenCalledWith({ x: 40, y: 60 }, { modes: ["AF", "AE", "AWB"], autoResetAfter: null });
      expect(screen.getByTestId("focus-square")).toBeVisible();
      expect(screen.getByRole("adjustable", { name: "Exposición" })).toBeTruthy();
      expect(exposure()).toBe(0);
    });

    it("a fixed-focus selfie camera still meters exposure on a tap", async () => {
      vision.useCameraDevices.mockReturnValue([vision.__devices.back, vision.__device({ id: "front-ff", position: "front", supportsFocusMetering: false, supportsWhiteBalanceMetering: false })]);
      await openCapture();
      await fireEvent.press(await screen.findByRole("button", { name: "Dar vuelta la cámara" }));
      await startSession("camera-front");
      await tap(10, 20);
      expect(vision.__focusTo).toHaveBeenCalledWith({ x: 10, y: 20 }, { modes: ["AE"], autoResetAfter: null });
    });

    it("after a tap, dragging up brightens and down darkens, within ±2 EV (the device allows ±8)", async () => {
      await openCapture();
      await startSession();
      await tap(40, 60);
      await drag(200, 300, -50);
      expect(exposure()).toBeCloseTo(1);
      await drag(200, 300, -25); // continues from the current bias
      expect(exposure()).toBeCloseTo(1.5);
      expect(screen.getByRole("adjustable", { name: "Exposición" }).props.accessibilityValue).toEqual({ text: "+1,5" });
      await drag(200, 300, -5000);
      expect(exposure()).toBe(2);
      await drag(200, 300, 5000);
      expect(exposure()).toBe(-2);
      expect(vision.__focusTo).toHaveBeenCalledTimes(1); // a drag is not a tap
    });

    it("the bias holds until a tap somewhere else resets it to 0", async () => {
      await openCapture();
      await startSession();
      await tap(40, 60);
      await drag(200, 300, -50);
      await tap(100, 120);
      expect(exposure()).toBe(0);
      expect(vision.__focusTo).toHaveBeenLastCalledWith({ x: 100, y: 120 }, expect.anything());
    });

    it("a drag before any tap does nothing to the exposure", async () => {
      await openCapture();
      await startSession();
      await drag(200, 300, -100);
      expect(exposure()).toBe(0);
      expect(screen.queryByTestId("focus-square")).toBeNull();
    });

    it("VoiceOver adjusts it a third of a stop at a time", async () => {
      await openCapture();
      await startSession();
      await tap(40, 60);
      const control = screen.getByRole("adjustable", { name: "Exposición" });
      await fireEvent(control, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
      expect(exposure()).toBeCloseTo(1 / 3);
      await fireEvent(control, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
      await fireEvent(control, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
      expect(exposure()).toBeCloseTo(-1 / 3);
    });

    it("pinching after a tap still zooms and leaves the exposure alone", async () => {
      await openCapture();
      await startSession();
      await tap(40, 60);
      const area = screen.getByTestId("camera-pinch");
      const touches = (gap: number) => ({ nativeEvent: { touches: [{ pageX: 100, pageY: 100 }, { pageX: 100 + gap, pageY: 100 }] } });
      await fireEvent(area, "responderGrant", touches(100));
      await fireEvent(area, "responderMove", touches(140));
      await fireEvent(area, "responderMove", { nativeEvent: { touches: [{ pageX: 100, pageY: 40 }] } }); // one finger lifted, the other moves up
      expect(vision.__controller.setZoom.mock.lastCall![0]).toBeCloseTo(2.8);
      expect(exposure()).toBe(0);
    });

    it("a device that cannot bias exposure still focuses, with no exposure control", async () => {
      vision.useCameraDevices.mockReturnValue([vision.__device({ id: "nobias", supportsExposureBias: false, minExposureBias: 0, maxExposureBias: 0 })]);
      await openCapture();
      await startSession();
      await tap(40, 60);
      expect(screen.getByTestId("focus-square")).toBeVisible();
      expect(screen.queryByRole("adjustable", { name: "Exposición" })).toBeNull();
      expect(exposure()).toBeUndefined();
    });

    it("flipping the camera starts over with no focus point and no bias", async () => {
      await openCapture();
      await startSession();
      await tap(40, 60);
      await drag(200, 300, -50);
      await fireEvent.press(screen.getByRole("button", { name: "Dar vuelta la cámara" }));
      await startSession("camera-front");
      expect(exposure("camera-front")).toBe(0);
      expect(screen.queryByTestId("focus-square")).toBeNull();
    });
  });

  it("turns on the automatic low-light boost when the device supports it", async () => {
    await openCapture();
    expect((await screen.findByTestId("camera-back")).props.enableLowLightBoost).toBe(true);
  });

  it("leaves the low-light boost alone on a device without it (VisionCamera throws even for false there)", async () => {
    vision.useCameraDevices.mockReturnValue([vision.__device({ id: "nolow", supportsLowLightBoost: false })]);
    await openCapture();
    expect((await screen.findByTestId("camera-back")).props.enableLowLightBoost).toBeUndefined();
  });

  describe("Cuadrícula", () => {
    it("toggles the rule-of-thirds grid and remembers it on the phone", async () => {
      await openCapture();
      const button = await screen.findByRole("button", { name: "Cuadrícula" });
      expect(button).not.toBeSelected();
      expect(screen.queryByTestId("camera-grid")).toBeNull();
      await fireEvent.press(button);
      expect(screen.getByTestId("camera-grid")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Cuadrícula" })).toBeSelected();
      await waitFor(() => expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith("rollo.cameraGrid", "1"));
      await fireEvent.press(screen.getByRole("button", { name: "Cuadrícula" }));
      expect(screen.queryByTestId("camera-grid")).toBeNull();
      await waitFor(() => expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith("rollo.cameraGrid", "0"));
    });

    it("opens with the grid on when the phone remembers it", async () => {
      await SecureStore.setItemAsync("rollo.cameraGrid", "1");
      await openCapture();
      expect(await screen.findByTestId("camera-grid")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Cuadrícula" })).toBeSelected();
    });
  });

  describe("Temporizador", () => {
    // renderRouter already runs on Jest's fake timers: each step advances the clock one second.
    const second = () => act(async () => jest.advanceTimersByTime(1000));

    it("cycles apagado → 3 → 10 segundos → apagado", async () => {
      await openCapture();
      await fireEvent.press(await screen.findByRole("button", { name: "Temporizador: apagado" }));
      expect(screen.getByRole("button", { name: "Temporizador: 3 segundos" })).toBeSelected();
      await fireEvent.press(screen.getByRole("button", { name: "Temporizador: 3 segundos" }));
      await fireEvent.press(screen.getByRole("button", { name: "Temporizador: 10 segundos" }));
      expect(screen.getByRole("button", { name: "Temporizador: apagado" })).not.toBeSelected();
    });

    it("counts down over the preview with a tick per second and shoots at 0", async () => {
      await openCapture();
      await startSession();
      await fireEvent.press(await screen.findByRole("button", { name: "Temporizador: apagado" }));
      Haptics.selectionAsync.mockClear();
      await shoot();
      expect(screen.getByTestId("timer-countdown")).toHaveTextContent("3");
      expect(takePhoto).not.toHaveBeenCalled();
      await second();
      expect(screen.getByTestId("timer-countdown")).toHaveTextContent("2");
      await second();
      expect(screen.getByTestId("timer-countdown")).toHaveTextContent("1");
      expect(takePhoto).not.toHaveBeenCalled();
      expect(Haptics.selectionAsync).toHaveBeenCalledTimes(3);
      await second();
      expect(takePhoto).toHaveBeenCalledTimes(1);
      expect(await screen.findByLabelText("Caption")).toBeVisible();
    });

    it("tapping the shutter during the countdown cancels it", async () => {
      await openCapture();
      await startSession();
      await fireEvent.press(await screen.findByRole("button", { name: "Temporizador: apagado" }));
      await shoot();
      await second();
      expect(screen.getByTestId("timer-countdown")).toHaveTextContent("2");
      await fireEvent.press(screen.getByRole("button", { name: "Cancelar temporizador" }));
      expect(screen.queryByTestId("timer-countdown")).toBeNull();
      for (let i = 0; i < 10; i++) await second();
      expect(takePhoto).not.toHaveBeenCalled();
      expect(screen.queryByTestId("timer-countdown")).toBeNull();
      expect(screen.getByRole("button", { name: "Sacar foto" })).toBeVisible();
    });
  });
});
