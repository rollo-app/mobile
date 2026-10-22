import { Alert } from "react-native";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { createQueue, type Queue, type QueuedMedia } from "@/features/capture/queue";
import * as actions from "@/features/trips/actions";
import { signInAs, tripSummary } from "@/test/account";
import { memoryDb } from "@/test/sqlite-memory";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/capture/sync", () => ({ syncQueue: jest.fn(async () => {}) }));
jest.mock("expo-network", () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
}));
const mocked = jest.mocked(actions);
const { getQueue } = jest.requireMock("@/features/capture/store") as { getQueue: jest.Mock };

const SUR = "11111111-1111-4111-8111-111111111111";
const DAY = 24 * 60 * 60 * 1000;

const detail = (): actions.TripDetail => ({
  trip: {
    id: SUR,
    name: "Viaje al sur",
    joinCode: "HUB5FT",
    timezone: "America/Argentina/Buenos_Aires",
    startsAt: Date.now() - 2 * DAY,
    endsAt: Date.now() + 9 * DAY,
    revealAt: Date.now() + 9 * DAY,
    revealed: false,
    dailyPhotoLimit: 10,
    dailyVideoLimit: 3,
  },
  me: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin", blockedByMe: false },
  members: [{ id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin", blockedByMe: false }],
  today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 1,
});

const queued = (id: string, overrides: Partial<QueuedMedia> = {}): QueuedMedia => ({
  id,
  tripId: SUR,
  type: "photo",
  takenAt: Date.parse("2027-01-05T17:32:00Z"),
  day: "2027-01-05",
  lat: null,
  lng: null,
  accuracyM: null,
  caption: null,
  durationS: null,
  width: 4000,
  height: 3000,
  sizeBytes: 1000,
  originalUri: `file:///docs/pending/${id}/original.jpg`,
  thumbUri: `file:///docs/pending/${id}/thumb.jpg`,
  thumbhash: null,
  ...overrides,
});

describe("Roll · Subidas", () => {
  let queue: Queue;

  beforeEach(async () => {
    await signInAs({ trips: [tripSummary(SUR, "Viaje al sur", { role: "admin" })] });
    mocked.fetchTrip.mockResolvedValue(detail());
    queue = await createQueue(memoryDb());
    getQueue.mockImplementation(() => Promise.resolve(queue));
  });

  it("with nothing pending or failed the section is not there", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByText("HUB5FT")).toBeVisible();
    expect(screen.queryByText(/esperando señal/)).toBeNull();
    expect(screen.queryByText("Subir ahora")).toBeNull();
  });

  it("shows what is waiting, the hint and the next retry", async () => {
    await queue.enqueue(queued("a"));
    await queue.enqueue(queued("b", { type: "video" }));
    await queue.markAttempt("a", Date.now() + 2 * 60_000 - 1000);
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByText("1 foto y 1 video esperando señal")).toBeVisible();
    expect(screen.getByText(/Se suben solas apenas hay conexión/)).toBeVisible();
    expect(screen.getByText(/Próximo intento en 2 min/)).toBeVisible();
  });

  it("there is no manual upload button: uploads happen on their own", async () => {
    await queue.enqueue(queued("a"));
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByText("1 foto esperando señal")).toBeVisible();
    expect(screen.queryByText("Subir ahora")).toBeNull();
    expect(screen.getByText(/Se suben solas apenas hay conexión\./)).toBeVisible();
  });

  it("failed photos show their reason in plain language", async () => {
    await queue.enqueue(queued("a"));
    await queue.enqueue(queued("b"));
    await queue.enqueue(queued("c"));
    await queue.markFailed("a", "Este rollo ya terminó");
    await queue.markFailed("b", "missing_file");
    await queue.markFailed("c", "deleted");
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByText("Este rollo ya terminó")).toBeVisible();
    expect(screen.getByText("El archivo ya no está en el celular")).toBeVisible();
    expect(screen.getByText("El admin la borró")).toBeVisible();
    expect(screen.queryByText(/esperando señal/)).toBeNull();
  });

  it("'Descartar' asks first and deletes only after confirming", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await queue.enqueue(queued("a"));
    await queue.markFailed("a", "no_token");
    await renderRouter(routes, { initialUrl: "/roll" });

    await fireEvent.press(await screen.findByRole("button", { name: "Descartar" }));

    expect(alert).toHaveBeenCalledWith(
      expect.any(String),
      "Esta foto no se va a subir y se borra del celular. No se puede deshacer.",
      [expect.objectContaining({ text: "Cancelar" }), expect.objectContaining({ text: "Descartar", style: "destructive" })],
    );
    expect(await queue.failed()).toHaveLength(1);

    const buttons = alert.mock.calls[0]?.[2] ?? [];
    await act(async () => {
      buttons[1]?.onPress?.();
    });

    await waitFor(() => expect(screen.queryByText("Ya no estás en este rollo")).toBeNull());
    expect(await queue.failed()).toEqual([]);
    alert.mockRestore();
  });
});
