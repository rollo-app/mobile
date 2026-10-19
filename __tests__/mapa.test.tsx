import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { createQueue, type Queue, type QueuedMedia } from "@/features/capture/queue";
import * as actions from "@/features/trips/actions";
import { saveSession } from "@/storage/trips";
import { memoryDb } from "@/test/sqlite-memory";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
const mocked = jest.mocked(actions);
const { getQueue } = jest.requireMock("@/features/capture/store") as { getQueue: jest.Mock };

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";

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
  me: { id: "m1", name: "Juani", role: "admin" },
  members: [
    { id: "m1", name: "Juani", role: "admin" },
    { id: "m2", name: "Fede", role: "member" },
  ],
  today: { date: "2027-01-12", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 3,
});

const feedItem = (over: Partial<actions.Feed["items"][number]> = {}): actions.Feed["items"][number] => ({
  id: "f1",
  type: "photo",
  takenAt: Date.parse("2027-01-12T16:10:00Z"),
  day: "2027-01-12",
  lat: -49.33,
  lng: -72.89,
  caption: "el viento no perdona",
  thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
  durationS: null,
  author: { id: "m2", name: "Fede" },
  ...over,
});

const feed = (items: actions.Feed["items"]): actions.Feed => ({ revealed: false, revealAt: Date.now() + DAY, items });

const queued = (over: Partial<QueuedMedia> = {}): QueuedMedia => ({
  id: "q1",
  tripId: SUR,
  type: "photo",
  takenAt: Date.parse("2027-01-12T17:00:00Z"),
  day: "2027-01-12",
  lat: -49.3,
  lng: -72.9,
  accuracyM: 10,
  caption: null,
  durationS: null,
  width: 4000,
  height: 3000,
  sizeBytes: 1000,
  originalUri: "file:///docs/pending/q1/original.jpg",
  thumbUri: "file:///docs/pending/q1/thumb.jpg",
  thumbhash: null,
  ...over,
});

let queue: Queue;

beforeEach(async () => {
  mocked.fetchTrip.mockResolvedValue(detail());
  mocked.fetchFeed.mockResolvedValue(feed([]));
  await saveSession({ tripId: SUR, tripName: "Viaje al sur", joinCode: "HUB5FT", memberId: "m1", memberName: "Juani", role: "admin", token: "t" });
  queue = await createQueue(memoryDb());
  getQueue.mockImplementation(() => Promise.resolve(queue));
});

describe("Mapa", () => {
  it("sin fotos con ubicación muestra el mapa con un aviso chico", async () => {
    await renderRouter(routes, { initialUrl: "/mapa" });

    expect(await screen.findByText("Todavía no hay fotos en el mapa")).toBeVisible();
    expect(screen.getByLabelText("mapa")).toBeVisible();
  });

  it("tocar un pin abre la tarjeta con autor, hora y caption; tocar el mapa vacío la cierra", async () => {
    mocked.fetchFeed.mockResolvedValue(feed([feedItem()]));
    await renderRouter(routes, { initialUrl: "/mapa" });

    await fireEvent.press(await screen.findByLabelText("pin f1"));
    expect(await screen.findByText("el viento no perdona")).toBeVisible();
    expect(screen.getByLabelText(/^Fede, /)).toBeVisible();
    expect(screen.queryByText("Todavía no hay fotos en el mapa")).toBeNull();

    await fireEvent.press(screen.getByLabelText("mapa"));
    await waitFor(() => expect(screen.queryByText("el viento no perdona")).toBeNull());
  });

  it("suma tus fotos pendientes con ubicación", async () => {
    await queue.enqueue(queued());
    await renderRouter(routes, { initialUrl: "/mapa" });

    await fireEvent.press(await screen.findByLabelText("pin q1"));
    expect(await screen.findByText("Esperando señal")).toBeVisible();
    expect(screen.getByLabelText(/^Juani, /)).toBeVisible();
  });

  it("el filtro Hoy deja solo las fotos del día del viaje", async () => {
    mocked.fetchFeed.mockResolvedValue(
      feed([feedItem({ id: "hoy" }), feedItem({ id: "ayer", day: "2027-01-11" })]),
    );
    await renderRouter(routes, { initialUrl: "/mapa" });
    expect(await screen.findByLabelText("pin ayer")).toBeVisible();

    await fireEvent.press(screen.getByRole("button", { name: "Hoy" }));

    expect(screen.getByLabelText("pin hoy")).toBeVisible();
    expect(screen.queryByLabelText("pin ayer")).toBeNull();
  });

  it("el menú Personas filtra por persona y también deja volver a todos", async () => {
    mocked.fetchFeed.mockResolvedValue(
      feed([feedItem({ id: "de-fede" }), feedItem({ id: "mia", author: { id: "m1", name: "Juani" } })]),
    );
    await renderRouter(routes, { initialUrl: "/mapa" });
    expect(await screen.findByLabelText("pin mia")).toBeVisible();

    await fireEvent.press(screen.getByRole("menuitem", { name: "Fede" }));
    expect(screen.queryByLabelText("pin mia")).toBeNull();
    expect(screen.getByLabelText("pin de-fede")).toBeVisible();

    await fireEvent.press(screen.getByRole("menuitem", { name: "Todos" }));
    expect(screen.getByLabelText("pin mia")).toBeVisible();
  });

  it("si el pedido falla y no hay cache, avisa chico y deja reintentar sin sacar el mapa", async () => {
    mocked.fetchFeed.mockRejectedValueOnce(new Error("Sin conexión"));
    await renderRouter(routes, { initialUrl: "/mapa" });

    expect(await screen.findByText("Sin conexión")).toBeVisible();
    expect(screen.getByLabelText("mapa")).toBeVisible();

    mocked.fetchFeed.mockResolvedValue(feed([feedItem()]));
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByLabelText("pin f1")).toBeVisible();
    expect(screen.queryByText("Sin conexión")).toBeNull();
  });

  it("muestra la atribución de OpenStreetMap como texto fijo", async () => {
    await renderRouter(routes, { initialUrl: "/mapa" });
    expect(await screen.findByText("© OpenStreetMap · OpenFreeMap")).toBeVisible();
  });

  it("tocar un pin con otras fotos en el mismo lugar abre un carrusel con todas, por hora", async () => {
    mocked.fetchFeed.mockResolvedValue(
      feed([
        feedItem({ id: "tarde", takenAt: Date.parse("2027-01-12T20:00:00Z"), author: { id: "m2", name: "Fede" } }),
        feedItem({ id: "temprano", takenAt: Date.parse("2027-01-12T15:00:00Z"), author: { id: "m1", name: "Juani" }, caption: "primera" }),
        feedItem({ id: "lejos", lat: -48.5, lng: -72.0, caption: "otra" }),
      ]),
    );
    await renderRouter(routes, { initialUrl: "/mapa" });

    await fireEvent.press(await screen.findByLabelText("pin tarde"));

    expect(await screen.findByTestId("pin-carousel")).toBeTruthy();
    expect(screen.getByText("primera")).toBeTruthy();
    expect(screen.queryByText("otra")).toBeNull();
  });

  it("Ver todas está a mano para volver a encuadrar", async () => {
    await renderRouter(routes, { initialUrl: "/mapa" });
    await fireEvent.press(await screen.findByRole("button", { name: "Ver todas" }));
    expect(screen.getByLabelText("mapa")).toBeVisible();
  });

  it("un cluster que no se puede abrir con zoom (mismo punto) abre el carrusel con sus hojas", async () => {
    mocked.fetchFeed.mockResolvedValue(
      feed([
        feedItem({ id: "a", caption: "una", takenAt: 1 }),
        feedItem({ id: "b", caption: "dos", takenAt: 2 }),
        feedItem({ id: "c", caption: "tres", lat: -48, takenAt: 3 }),
      ]),
    );
    await renderRouter(routes, { initialUrl: "/mapa" });

    await fireEvent.press(await screen.findByLabelText("cluster"));

    expect(await screen.findByTestId("pin-carousel")).toBeTruthy();
    expect(screen.getByText("una")).toBeTruthy();
    expect(screen.getByText("dos")).toBeTruthy();
    expect(screen.queryByText("tres")).toBeNull();
  });
});
