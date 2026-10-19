import { act } from "@testing-library/react-native";
import { ActionSheetIOS, Alert } from "react-native";
import * as sections from "@/features/feed/sections";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { createQueue, type Queue, type QueuedMedia } from "@/features/capture/queue";
import * as actions from "@/features/trips/actions";
import { saveSession } from "@/storage/trips";
import { memoryDb } from "@/test/sqlite-memory";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
const mocked = jest.mocked(actions);
const { __camera: camera } = jest.requireMock("@maplibre/maplibre-react-native") as { __camera: { flyTo: jest.Mock } };
const { getQueue } = jest.requireMock("@/features/capture/store") as { getQueue: jest.Mock };

const EMPTY = "Todavía no hay fotos. Las que saque cada uno van a aparecer acá.";
const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";

const detail = (role: "admin" | "member" = "admin"): actions.TripDetail => ({
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
  me: { id: "m1", name: "Juani", role },
  members: [
    { id: "m1", name: "Juani", role },
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
  lat: null,
  lng: null,
  accuracyM: null,
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
let alert: jest.SpyInstance;
const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation(() => {});
jest.mock("expo-haptics", () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: "light" } }));

beforeEach(async () => {
  mocked.fetchTrip.mockResolvedValue(detail());
  mocked.fetchFeed.mockResolvedValue(feed([]));
  mocked.deleteMedia.mockResolvedValue(undefined);
  sheet.mockClear();
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await saveSession({ tripId: SUR, tripName: "Viaje al sur", joinCode: "HUB5FT", memberId: "m1", memberName: "Juani", role: "admin", token: "t" });
  queue = await createQueue(memoryDb());
  getQueue.mockImplementation(() => Promise.resolve(queue));
});

afterEach(() => alert.mockRestore());

describe("Feed", () => {
  it("agrupa por día, del más nuevo al más viejo, con lo último de cada día primero", async () => {
    mocked.fetchFeed.mockResolvedValue(
      feed([
        feedItem({ id: "a", day: "2027-01-11", takenAt: Date.parse("2027-01-11T15:00:00Z"), caption: "ayer vieja" }),
        feedItem({ id: "b", takenAt: Date.parse("2027-01-12T15:00:00Z"), caption: "temprano" }),
        feedItem({ id: "c", takenAt: Date.parse("2027-01-12T20:00:00Z"), caption: "tarde" }),
      ]),
    );
    await renderRouter(routes, { initialUrl: "/feed" });

    await screen.findByText("tarde");
    const texts = screen.getAllByText(/^(Martes 12|Lunes 11|tarde|temprano|ayer vieja)$/).map((n) => n.props.children);
    expect(texts).toEqual(["Martes 12", "tarde", "temprano", "Lunes 11", "ayer vieja"]);
  });

  it("tus fotos sin subir van en su día con 'Esperando señal'", async () => {
    await queue.enqueue(queued());
    await renderRouter(routes, { initialUrl: "/feed" });

    expect(await screen.findByText("Esperando señal")).toBeVisible();
    expect(screen.getByText("Juani")).toBeVisible();
    expect(screen.getByText("Martes 12")).toBeVisible();
  });

  it("tocar una fila con ubicación lleva al mapa centrado en esa foto", async () => {
    mocked.fetchFeed.mockResolvedValue(feed([feedItem()]));
    await renderRouter(routes, { initialUrl: "/feed" });

    await fireEvent.press(await screen.findByRole("button", { name: /^Fede, / }));

    await waitFor(() => expect(screen).toHavePathname("/mapa"));
    // El Mapa recibió el id: vuela a la foto.
    await waitFor(() => expect(camera.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [-72.89, -49.33], zoom: 15 })));
  });

  it("una fila sin ubicación no es tocable", async () => {
    mocked.fetchFeed.mockResolvedValue(feed([feedItem({ lat: null, lng: null })]));
    await renderRouter(routes, { initialUrl: "/feed" });

    await screen.findByText("el viento no perdona");
    expect(screen.queryByRole("button", { name: /^Fede, / })).toBeNull();
  });

  it("deslizar para actualizar vuelve a pedir el feed", async () => {
    await renderRouter(routes, { initialUrl: "/feed" });
    await screen.findByText(EMPTY);
    mocked.fetchFeed.mockClear();

    await act(async () => {
      await screen.getByTestId("feed-list").props.refreshControl.props.onRefresh();
    });

    expect(mocked.fetchFeed).toHaveBeenCalledTimes(1);
  });

  it("no recalcula la agrupación en cada render", async () => {
    mocked.fetchFeed.mockResolvedValue(feed([feedItem()]));
    const group = jest.spyOn(sections, "groupByDay");
    await renderRouter(routes, { initialUrl: "/feed" });
    await screen.findByText("el viento no perdona");
    const before = group.mock.calls.length;

    // Refrescar cambia el estado de la pantalla (re-render) pero no los datos.
    await act(async () => {
      await screen.getByTestId("feed-list").props.refreshControl.props.onRefresh();
    });

    expect(group.mock.calls.length).toBe(before);
    group.mockRestore();
  });

  it("muestra de a tandas y carga más al llegar al final de la lista", async () => {
    const many = Array.from({ length: 70 }, (_, n) => feedItem({ id: `f${n}`, takenAt: 1_800_000_000_000 + n * 60_000 }));
    mocked.fetchFeed.mockResolvedValue(feed(many));
    await renderRouter(routes, { initialUrl: "/feed" });
    await screen.findByTestId("feed-list");
    // El host no expone las props de la lista: se sube hasta el SectionList.
    const list = () => {
      let node: { props: Record<string, any>; parent: any } | null = screen.getByTestId("feed-list");
      while (node && !node.props.onEndReached) node = node.parent;
      return node!.props;
    };
    const sectionsOf = () => {
      const p = list();
      return (p.sections ?? p.data) as { data: unknown[] }[];
    };
    const rows = () => sectionsOf().reduce((n, s) => n + s.data.length, 0);

    await waitFor(() => expect(rows()).toBe(30));
    await act(async () => list().onEndReached());
    expect(rows()).toBe(60);
    await act(async () => list().onEndReached());
    await act(async () => list().onEndReached());
    expect(rows()).toBe(70);
  });

  describe("admin", () => {
    it("Borrar foto pide confirmación y, si confirma, borra y vuelve a pedir feed y viaje", async () => {
      mocked.fetchFeed.mockResolvedValue(feed([feedItem()]));
      await renderRouter(routes, { initialUrl: "/feed" });
      await screen.findByText("el viento no perdona");
      mocked.fetchFeed.mockClear();
      mocked.fetchTrip.mockClear();

      await fireEvent(screen.getByLabelText(/^Fede, /), "longPress");
      sheet.mock.calls[0]![1](0);

      expect(alert).toHaveBeenCalledWith(
        "¿Borrar esta foto?",
        "No se puede deshacer.",
        expect.arrayContaining([
          expect.objectContaining({ text: "Cancelar", style: "cancel" }),
          expect.objectContaining({ text: "Borrar", style: "destructive" }),
        ]),
      );
      expect(mocked.deleteMedia).not.toHaveBeenCalled();

      const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
      await act(async () => buttons.find((b) => b.text === "Borrar")!.onPress!());

      expect(mocked.deleteMedia).toHaveBeenCalledWith(SUR, "f1");
      await waitFor(() => expect(mocked.fetchFeed).toHaveBeenCalled());
      await waitFor(() => expect(mocked.fetchTrip).toHaveBeenCalled());
    });

    it("si el server rechaza, avisa con una alerta con su mensaje", async () => {
      mocked.fetchFeed.mockResolvedValue(feed([feedItem()]));
      mocked.deleteMedia.mockRejectedValue(new Error("El viaje ya se reveló"));
      await renderRouter(routes, { initialUrl: "/feed" });
      await screen.findByText("el viento no perdona");

      await fireEvent(screen.getByLabelText(/^Fede, /), "longPress");
      sheet.mock.calls[0]![1](0);
      const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
      await act(async () => buttons.find((b) => b.text === "Borrar")!.onPress!());

      await waitFor(() => expect(alert).toHaveBeenLastCalledWith("No se pudo borrar", "El viaje ya se reveló"));
    });

    it("una foto pendiente no se puede borrar", async () => {
      await queue.enqueue(queued());
      await renderRouter(routes, { initialUrl: "/feed" });

      await screen.findByText("Esperando señal");
      await fireEvent(screen.getByText("Juani"), "longPress");
      expect(sheet).not.toHaveBeenCalled();
    });
  });

  it("un miembro que no es admin no puede borrar", async () => {
    mocked.fetchTrip.mockResolvedValue(detail("member"));
    mocked.fetchFeed.mockResolvedValue(feed([feedItem()]));
    await renderRouter(routes, { initialUrl: "/feed" });

    await screen.findByText("el viento no perdona");
    await fireEvent(screen.getByText("Fede"), "longPress");
    expect(sheet).not.toHaveBeenCalled();
  });

  it("sin fotos explica que van a aparecer acá", async () => {
    await renderRouter(routes, { initialUrl: "/feed" });
    expect(await screen.findByText(EMPTY)).toBeVisible();
  });

  it("mientras carga muestra un indicador chico y no el vacío", async () => {
    mocked.fetchFeed.mockReturnValue(new Promise(() => {}));
    await renderRouter(routes, { initialUrl: "/feed" });

    expect(await screen.findByTestId("feed-loading")).toBeTruthy();
    expect(screen.queryByText(EMPTY)).toBeNull();
  });

  it("si falla y no hay cache muestra el error con Reintentar", async () => {
    mocked.fetchFeed.mockRejectedValueOnce(new Error("Sin conexión"));
    await renderRouter(routes, { initialUrl: "/feed" });

    expect(await screen.findByText("Sin conexión")).toBeVisible();
    mocked.fetchFeed.mockResolvedValue(feed([feedItem()]));
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("el viento no perdona")).toBeVisible();
    expect(screen.queryByText("Sin conexión")).toBeNull();
  });
});
