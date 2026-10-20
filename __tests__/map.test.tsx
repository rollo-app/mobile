import { StyleSheet, Text } from "react-native";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { createQueue, type Queue, type QueuedMedia } from "@/features/capture/queue";
import * as actions from "@/features/trips/actions";
import { markPresentationSeen } from "@/storage/presentation";
import { signInAs, tripSummary } from "@/test/account";
import { memoryDb } from "@/test/sqlite-memory";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
const mocked = jest.mocked(actions);
const { __camera: camera, __getClusterLeaves: getClusterLeaves, __mapProps: mapProps } = jest.requireMock("@maplibre/maplibre-react-native") as {
  __camera: { flyTo: jest.Mock; easeTo: jest.Mock };
  __getClusterLeaves: jest.Mock;
  __mapProps: { current: Record<string, any> };
};
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
  me: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin" },
  members: [
    { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin" },
    { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null, role: "member" },
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
  author: { id: "m2", name: "Fede", username: null, avatarUrl: null },
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
  await markPresentationSeen(SUR); // the first-open presentation would cover the revealed map
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur", { role: "admin" })] });
  queue = await createQueue(memoryDb());
  getQueue.mockImplementation(() => Promise.resolve(queue));
});

describe("Map", () => {
  it("with no photos with a location it shows the map with a small notice", async () => {
    await renderRouter(routes, { initialUrl: "/map" });

    expect(await screen.findByText("Todavía no hay fotos en el mapa")).toBeVisible();
    expect(screen.getByLabelText("mapa")).toBeVisible();
  });

  it("tapping a pin opens the card with author, time and caption; tapping the empty map closes it", async () => {
    mocked.fetchFeed.mockResolvedValue(feed([feedItem()]));
    await renderRouter(routes, { initialUrl: "/map" });

    await fireEvent.press(await screen.findByLabelText("pin f1"));
    expect(await screen.findByText("el viento no perdona")).toBeVisible();
    expect(screen.getByLabelText(/^Fede, /)).toBeVisible();
    expect(screen.queryByText("Todavía no hay fotos en el mapa")).toBeNull();

    await fireEvent.press(screen.getByLabelText("mapa"));
    await waitFor(() => expect(screen.queryByText("el viento no perdona")).toBeNull());
  });

  it("adds your pending photos with a location", async () => {
    await queue.enqueue(queued());
    await renderRouter(routes, { initialUrl: "/map" });

    await fireEvent.press(await screen.findByLabelText("pin q1"));
    expect(await screen.findByText("Esperando señal")).toBeVisible();
    expect(screen.getByLabelText(/^Juani, /)).toBeVisible();
  });

  it("the Hoy filter keeps only the photos from the trip day", async () => {
    mocked.fetchFeed.mockResolvedValue(
      feed([feedItem({ id: "hoy" }), feedItem({ id: "ayer", day: "2027-01-11" })]),
    );
    await renderRouter(routes, { initialUrl: "/map" });
    expect(await screen.findByLabelText("pin ayer")).toBeVisible();

    await fireEvent.press(screen.getByRole("button", { name: "Hoy" }));

    expect(screen.getByLabelText("pin hoy")).toBeVisible();
    expect(screen.queryByLabelText("pin ayer")).toBeNull();
  });

  it("once the roll is revealed there is no Hoy filter, only Personas", async () => {
    mocked.fetchTrip.mockResolvedValue({ ...detail(), trip: { ...detail().trip, revealed: true, endsAt: Date.now() - DAY } });
    await renderRouter(routes, { initialUrl: "/map" });

    expect(await screen.findByText("Personas")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Hoy" })).toBeNull();
  });

  it("the Personas menu filters by person and also lets you go back to everyone", async () => {
    mocked.fetchFeed.mockResolvedValue(
      feed([feedItem({ id: "de-fede" }), feedItem({ id: "mia", author: { id: "m1", name: "Juani", username: null, avatarUrl: null } })]),
    );
    await renderRouter(routes, { initialUrl: "/map" });
    expect(await screen.findByLabelText("pin mia")).toBeVisible();

    await fireEvent.press(screen.getByRole("menuitem", { name: "Fede" }));
    expect(screen.queryByLabelText("pin mia")).toBeNull();
    expect(screen.getByLabelText("pin de-fede")).toBeVisible();

    await fireEvent.press(screen.getByRole("menuitem", { name: "Todos" }));
    expect(screen.getByLabelText("pin mia")).toBeVisible();
  });

  it("if the request fails with no cache, it shows a small notice and allows retrying without removing the map", async () => {
    mocked.fetchFeed.mockRejectedValueOnce(new Error("Sin conexión"));
    await renderRouter(routes, { initialUrl: "/map" });

    expect(await screen.findByText("Sin conexión")).toBeVisible();
    expect(screen.getByLabelText("mapa")).toBeVisible();

    mocked.fetchFeed.mockResolvedValue(feed([feedItem()]));
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByLabelText("pin f1")).toBeVisible();
    expect(screen.queryByText("Sin conexión")).toBeNull();
  });

  it("shows the OpenStreetMap attribution as fixed text", async () => {
    await renderRouter(routes, { initialUrl: "/map" });
    expect(await screen.findByText("© OpenStreetMap · OpenFreeMap")).toBeVisible();
  });

  it("tapping a pin with other photos at the same place opens a carousel with all of them, by time", async () => {
    mocked.fetchFeed.mockResolvedValue(
      feed([
        feedItem({ id: "tarde", takenAt: Date.parse("2027-01-12T20:00:00Z"), author: { id: "m2", name: "Fede", username: null, avatarUrl: null } }),
        feedItem({ id: "temprano", takenAt: Date.parse("2027-01-12T15:00:00Z"), author: { id: "m1", name: "Juani", username: null, avatarUrl: null }, caption: "primera" }),
        feedItem({ id: "lejos", lat: -48.5, lng: -72.0, caption: "otra" }),
      ]),
    );
    await renderRouter(routes, { initialUrl: "/map" });

    await fireEvent.press(await screen.findByLabelText("pin tarde"));

    expect(await screen.findByTestId("pin-carousel")).toBeTruthy();
    expect(screen.getByText("primera")).toBeTruthy();
    expect(screen.queryByText("otra")).toBeNull();
  });

  it("Ver todas is at hand to reframe", async () => {
    await renderRouter(routes, { initialUrl: "/map" });
    await fireEvent.press(await screen.findByRole("button", { name: "Ver todas" }));
    expect(screen.getByLabelText("mapa")).toBeVisible();
  });

  describe("tapping a cluster", () => {
    const clusterFeed = () =>
      feed([
        feedItem({ id: "a", caption: "una", takenAt: 1 }),
        feedItem({ id: "b", caption: "dos", takenAt: 2 }),
        feedItem({ id: "c", caption: "tres", lat: -48, takenAt: 3 }),
      ]);

    it("opens the carousel with all its photos instead of zooming", async () => {
      mocked.fetchFeed.mockResolvedValue(clusterFeed());
      await renderRouter(routes, { initialUrl: "/map" });

      await fireEvent.press(await screen.findByLabelText("cluster"));

      expect(await screen.findByTestId("pin-carousel")).toBeTruthy();
      expect(screen.getByText("una")).toBeTruthy();
      expect(screen.getByText("dos")).toBeTruthy();
      expect(screen.queryByText("tres")).toBeNull();
      expect(getClusterLeaves).toHaveBeenCalledWith(1, 500, 0);
    });

    it("only recenters the camera, keeping the zoom and leaving room for the carousel", async () => {
      mocked.fetchFeed.mockResolvedValue(clusterFeed());
      await renderRouter(routes, { initialUrl: "/map" });
      camera.easeTo.mockClear();

      await fireEvent.press(await screen.findByLabelText("cluster"));
      await screen.findByTestId("pin-carousel");

      expect(camera.easeTo).toHaveBeenCalledTimes(1);
      const options = camera.easeTo.mock.calls[0]![0];
      expect(options.center).toEqual([-72.89, -49.33]);
      expect(options).not.toHaveProperty("zoom");
      expect(options.padding.bottom).toBeGreaterThan(120);
    });

    it("tapping the empty map closes the carousel and gives the padding back", async () => {
      mocked.fetchFeed.mockResolvedValue(clusterFeed());
      await renderRouter(routes, { initialUrl: "/map" });
      await fireEvent.press(await screen.findByLabelText("cluster"));
      await screen.findByTestId("pin-carousel");
      camera.easeTo.mockClear();

      await fireEvent.press(screen.getByLabelText("mapa"));

      await waitFor(() => expect(screen.queryByTestId("pin-carousel")).toBeNull());
      expect(camera.easeTo).toHaveBeenCalledWith(expect.objectContaining({ padding: expect.objectContaining({ bottom: 0 }) }));
    });
  });

  it("shows the native compass at the top right, below the Ver todas and location buttons", async () => {
    await renderRouter(routes, { initialUrl: "/map" });
    await screen.findByLabelText("mapa");

    const props = mapProps.current;
    expect(props.compass).toBe(true);
    expect(props.compassHiddenFacingNorth).not.toBe(false);
    expect(props.compassPosition).toEqual({ top: expect.any(Number), right: 16 });
    let node = screen.getByRole("button", { name: "Ver todas" }).parent;
    while (node && typeof StyleSheet.flatten(node.props.style)?.top !== "number") node = node.parent;
    const buttonsTop = StyleSheet.flatten(node!.props.style).top as number;
    expect(props.compassPosition.top).toBeGreaterThanOrEqual(buttonsTop + 40);
  });

  it("if focus arrives (from the Feed) it opens that photo's card, even if the filter hides it", async () => {
    mocked.fetchFeed.mockResolvedValue(
      feed([feedItem({ id: "otra", caption: "otra cosa", lat: -48.5, lng: -72.0 }), feedItem({ id: "ayer", day: "2027-01-11", caption: "la de ayer" })]),
    );
    await renderRouter(routes, { initialUrl: "/map?focus=ayer" });

    expect(await screen.findByText("la de ayer")).toBeVisible();
    expect(screen.queryByText("otra cosa")).toBeNull();
    expect(camera.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [-72.89, -49.33], zoom: 15 }));
  });

  it("consumes the focus: after opening it, the param is cleared", async () => {
    mocked.fetchFeed.mockResolvedValue(feed([feedItem()]));
    await renderRouter(routes, { initialUrl: "/map?focus=f1" });

    await screen.findByText("el viento no perdona");
    await waitFor(() => expect(screen).not.toHaveSearchParams({ focus: "f1" }));
  });

  it("after the reveal the card shows the real photo and tapping it opens the viewer", async () => {
    mocked.fetchTrip.mockResolvedValue({ ...detail(), trip: { ...detail().trip, revealed: true, endsAt: Date.now() - DAY } });
    mocked.fetchFeed.mockResolvedValue({
      ...feed([feedItem({ files: { thumb: "/media/f1/thumb", original: "/media/f1/original" } })]),
      revealed: true,
    });
    await renderRouter({ ...routes, "photo/[id]": () => <Text>Foto</Text> }, { initialUrl: "/map" });

    await fireEvent.press(await screen.findByLabelText("pin f1"));
    await waitFor(() => expect(screen.getByTestId("pin-thumb").props.source).toEqual([expect.objectContaining({ uri: expect.stringContaining("/media/f1/thumb") })]));

    await fireEvent.press(screen.getByRole("button", { name: /^Fede, / }));
    expect(await screen.findByText("Foto")).toBeVisible();
    expect(screen).toHavePathname("/photo/f1");
  });
});
