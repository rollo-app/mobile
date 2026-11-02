import { StyleSheet, Text } from "react-native";
import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import "@/test/reanimated";
import { createQueue, type Queue, type QueuedMedia } from "@/features/capture/queue";
import * as actions from "@/features/trips/actions";
import { markPresentationSeen } from "@/storage/presentation";
import { signInAs, tripSummary, USER } from "@/test/account";
import { pinAvatarKey } from "@/features/map/pin-avatars";
import { memoryDb } from "@/test/sqlite-memory";
import { routes } from "@/test/routes";
import { colors } from "@/ui/theme";
import * as featuredActions from "@/features/featured/actions";

jest.mock("@/features/trips/actions");
// Perfil is mounted too: nobody has featured photos, so its own "Reintentar" stays out of the way.
jest.mock("@/features/featured/actions");
beforeEach(() => {
  jest.mocked(featuredActions).fetchFeatured.mockResolvedValue([]);
});
const mocked = jest.mocked(actions);
const { __camera: camera, __getClusterLeaves: getClusterLeaves, __mapProps: mapProps } = jest.requireMock("@maplibre/maplibre-react-native") as {
  __camera: { flyTo: jest.Mock; easeTo: jest.Mock };
  __getClusterLeaves: jest.Mock;
  __mapProps: { current: Record<string, any> };
};
const { __imagesProps: imagesProps, __mapMounts: mapMounts } = jest.requireMock("@maplibre/maplibre-react-native") as {
  __imagesProps: { current: Record<string, any> };
  __mapMounts: { current: number };
};
const { __cameraProps: cameraProps } = jest.requireMock("@maplibre/maplibre-react-native") as {
  __cameraProps: { current: Record<string, any> | null };
};
const location = jest.requireMock("expo-location") as {
  getForegroundPermissionsAsync: jest.Mock;
  getLastKnownPositionAsync: jest.Mock;
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
    featuringDisabled: false,
    photoLimitMode: "daily",
    totalPhotoLimit: null,
    momentMode: "off",
    momentWindowStart: 540,
    momentWindowEnd: 1380,
    createdBy: null,
  },
  me: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin", isCreator: false, blockedByMe: false },
  members: [
    { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin", isCreator: false, blockedByMe: false },
    { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null, role: "member", isCreator: false, blockedByMe: false },
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
  author: { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null },
  ...over,
});

/** The map's "Mapa" segment: Perfil (also mounted in tests) has its own "Fotos | Mapa" control. */
const mapSegment = () => {
  const profile = within(screen.getByTestId("profile-showcase")).getByRole("button", { name: "Mapa" });
  return screen.getAllByRole("button", { name: "Mapa" }).find((b) => b !== profile)!;
};

const feed = (items: actions.Feed["items"]): actions.Feed => ({ revealed: false, revealAt: Date.now() + DAY, items });

const queued = (over: Partial<QueuedMedia> = {}): QueuedMedia => ({
  id: "q1",
  tripId: SUR,
  ownerUserId: "u1",
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
  describe("starting view", () => {
    beforeEach(() => {
      cameraProps.current = null;
    });

    it("with no pins, the trip not in progress and no location permission, starts on the whole world", async () => {
      mocked.fetchTrip.mockResolvedValue({ ...detail(), trip: { ...detail().trip, startsAt: Date.now() + DAY, endsAt: Date.now() + 9 * DAY } });
      await renderRouter(routes, { initialUrl: "/map" });

      await screen.findByLabelText("mapa");
      expect(cameraProps.current!.initialViewState).toEqual({ center: [0, 20], zoom: 1 });
    });

    it("with pins, starts framing them", async () => {
      mocked.fetchTrip.mockResolvedValue({ ...detail(), trip: { ...detail().trip, startsAt: Date.now() + DAY, endsAt: Date.now() + 9 * DAY } });
      mocked.fetchFeed.mockResolvedValue(feed([feedItem({ id: "a", lat: -34.9, lng: -56.2 }), feedItem({ id: "b", lat: -34.5, lng: -58.4 })]));
      await renderRouter(routes, { initialUrl: "/map" });

      await screen.findByLabelText("mapa");
      expect(cameraProps.current!.initialViewState).toEqual({ bounds: [-58.4, -34.9, -56.2, -34.5], padding: expect.any(Object) });
    });

    it("with no pins but location permission, starts where you are at city level, without asking", async () => {
      location.getForegroundPermissionsAsync.mockResolvedValue({ granted: true });
      location.getLastKnownPositionAsync.mockResolvedValue({ coords: { latitude: -34.9, longitude: -56.16 } });
      mocked.fetchTrip.mockResolvedValue({ ...detail(), trip: { ...detail().trip, startsAt: Date.now() + DAY, endsAt: Date.now() + 9 * DAY } });
      try {
        await renderRouter(routes, { initialUrl: "/map" });

        await screen.findByLabelText("mapa");
        expect(cameraProps.current!.initialViewState).toEqual({ center: [-56.16, -34.9], zoom: 10 });
      } finally {
        location.getForegroundPermissionsAsync.mockResolvedValue({ granted: false });
        location.getLastKnownPositionAsync.mockResolvedValue(null);
      }
    });

    it("with the trip in progress and location permission, starts where you are", async () => {
      location.getForegroundPermissionsAsync.mockResolvedValue({ granted: true });
      location.getLastKnownPositionAsync.mockResolvedValue({ coords: { latitude: -34.9, longitude: -56.16 } });
      mocked.fetchFeed.mockResolvedValue(feed([feedItem()]));
      try {
        await renderRouter(routes, { initialUrl: "/map" });

        await screen.findByLabelText("mapa");
        expect(cameraProps.current!.initialViewState).toEqual({ center: [-56.16, -34.9], zoom: 12 });
      } finally {
        location.getForegroundPermissionsAsync.mockResolvedValue({ granted: false });
        location.getLastKnownPositionAsync.mockResolvedValue(null);
      }
    });
  });

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

  it("registers the author's photo as a map image and tells the pin to use it once it is ready", async () => {
    mocked.fetchFeed.mockResolvedValue(
      feed([feedItem({ author: { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: "/avatars/m2-v1.jpg" } })]),
    );
    await renderRouter(routes, { initialUrl: "/map" });

    const key = pinAvatarKey("m2", "/avatars/m2-v1.jpg");
    await waitFor(() => expect(imagesProps.current.images).toEqual({ [key]: `file:///cache/pin-avatar/${key}.png` }));
  });

  it("registers no map images for authors without a photo", async () => {
    mocked.fetchFeed.mockResolvedValue(feed([feedItem()]));
    await renderRouter(routes, { initialUrl: "/map" });

    expect(await screen.findByLabelText("pin f1")).toBeVisible();
    expect(imagesProps.current.images).toEqual({});
  });

  it("adds your pending photos with a location", async () => {
    await queue.enqueue(queued());
    await renderRouter(routes, { initialUrl: "/map" });

    await fireEvent.press(await screen.findByLabelText("pin q1"));
    expect(await screen.findByText("Esperando señal")).toBeVisible();
    expect(screen.getByLabelText(/^Juani, /)).toBeVisible();
  });

  it("Solo hoy in the filter menu keeps only the photos from the trip day and turns the pill cobalt", async () => {
    mocked.fetchFeed.mockResolvedValue(
      feed([feedItem({ id: "hoy" }), feedItem({ id: "ayer", day: "2027-01-11" })]),
    );
    await renderRouter(routes, { initialUrl: "/map" });
    expect(await screen.findByLabelText("pin ayer")).toBeVisible();
    expect(screen.getByText("Filtros")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Hoy" })).toBeNull();

    await fireEvent.press(screen.getByRole("menuitem", { name: "Solo hoy" }));

    expect(screen.getByLabelText("pin hoy")).toBeVisible();
    expect(screen.queryByLabelText("pin ayer")).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Solo hoy" }).props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByText("Hoy")).toHaveStyle({ color: colors.tint });

    await fireEvent.press(screen.getByRole("menuitem", { name: "Solo hoy" }));
    expect(screen.getByLabelText("pin ayer")).toBeVisible();
    expect(screen.getByText("Filtros")).toBeVisible();
  });

  it("Momentos in the filter menu keeps only the daily moments and turns the pill cobalt", async () => {
    mocked.fetchFeed.mockResolvedValue(
      feed([feedItem({ id: "normal" }), feedItem({ id: "mo1", momentDay: "2027-01-12", files: { thumb: "/media/mo1/thumb", original: "/media/mo1/original" } })]),
    );
    await renderRouter(routes, { initialUrl: "/map" });
    expect(await screen.findByLabelText("pin normal")).toBeVisible();

    await fireEvent.press(screen.getByRole("menuitem", { name: "Momentos" }));

    expect(screen.getByLabelText("pin mo1")).toBeVisible();
    expect(screen.queryByLabelText("pin normal")).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Momentos" }).props.accessibilityState).toEqual({ checked: true });
    // The pill now names the filter (the menu item has the same label), in cobalt.
    expect(screen.getAllByText("Momentos").some((n) => StyleSheet.flatten(n.props.style)?.color === colors.tint)).toBe(true);

    await fireEvent.press(screen.getByRole("menuitem", { name: "Momentos" }));
    expect(screen.getByLabelText("pin normal")).toBeVisible();
    expect(screen.getByText("Filtros")).toBeVisible();
  });

  it("before the reveal a moment's card shows the real photo and opens the viewer; an ordinary card stays blurry and closed", async () => {
    mocked.fetchFeed.mockResolvedValue(
      feed([
        feedItem({ id: "mo1", momentDay: "2027-01-12", files: { thumb: "/media/mo1/thumb", original: "/media/mo1/original" } }),
        feedItem({ id: "normal", lat: -40, lng: -70 }),
      ]),
    );
    await renderRouter({ ...routes, "photo/[id]": () => <Text>Foto</Text> }, { initialUrl: "/map" });

    await fireEvent.press(await screen.findByLabelText("pin normal"));
    expect(screen.getByTestId("pin-thumb").props.source).toEqual([]);
    expect(screen.queryByRole("button", { name: /^Fede, / })).toBeNull();

    await fireEvent.press(screen.getByLabelText("pin mo1"));
    await waitFor(() => expect(screen.getByTestId("pin-thumb").props.source).toEqual([expect.objectContaining({ uri: expect.stringContaining("/media/mo1/thumb") })]));
    await fireEvent.press(screen.getByRole("button", { name: /^Fede, / }));

    expect(await screen.findByText("Foto")).toBeVisible();
    expect(screen).toHavePathname("/photo/mo1");
    expect(screen).toHaveSearchParams({ id: "mo1", tripId: SUR });
  });

  it("once the roll is revealed there is no Solo hoy and no Mapa | Feed, only the people filter", async () => {
    mocked.fetchTrip.mockResolvedValue({ ...detail(), trip: { ...detail().trip, revealed: true, endsAt: Date.now() - DAY } });
    await renderRouter(routes, { initialUrl: "/map" });

    expect(await screen.findByRole("menuitem", { name: "Todos" })).toBeVisible();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Feed" })).toBeNull());
    expect(screen.queryByRole("menuitem", { name: "Solo hoy" })).toBeNull();
    expect(screen.getByText("Filtros")).toBeVisible();
  });

  it("once the roll is revealed view=feed still shows the map", async () => {
    mocked.fetchTrip.mockResolvedValue({ ...detail(), trip: { ...detail().trip, revealed: true, endsAt: Date.now() - DAY } });
    await renderRouter(routes, { initialUrl: "/map?view=feed" });

    expect(await screen.findByRole("menuitem", { name: "Todos" })).toBeVisible();
    await waitFor(() => expect(screen.queryByTestId("feed-list")).toBeNull());
    expect(screen.getByLabelText("mapa")).toBeVisible();
  });

  it("the people filter names the person on the pill and goes back to everyone", async () => {
    mocked.fetchFeed.mockResolvedValue(
      feed([feedItem({ id: "de-fede" }), feedItem({ id: "mia", author: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null } })]),
    );
    await renderRouter(routes, { initialUrl: "/map" });
    expect(await screen.findByLabelText("pin mia")).toBeVisible();

    await fireEvent.press(screen.getByRole("menuitem", { name: "Fede" }));
    expect(screen.queryByLabelText("pin mia")).toBeNull();
    expect(screen.getByLabelText("pin de-fede")).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Fede" }).props.accessibilityState).toEqual({ checked: true });

    await fireEvent.press(screen.getByRole("menuitem", { name: "Solo hoy" }));
    expect(screen.getByText("Hoy · Fede")).toBeVisible();

    await fireEvent.press(screen.getByRole("menuitem", { name: "Todos" }));
    expect(screen.getByLabelText("pin mia")).toBeVisible();
    expect(screen.getByText("Hoy")).toBeVisible();
  });

  describe("Mapa | Feed", () => {
    beforeEach(() => {
      mapMounts.current = 0;
    });

    it("shows the segmented control on the map and Feed draws the list over it", async () => {
      mocked.fetchFeed.mockResolvedValue(feed([feedItem()]));
      await renderRouter(routes, { initialUrl: "/map" });

      await screen.findByRole("button", { name: "Feed" });
      expect(mapSegment()).toBeVisible();
      expect(screen.queryByTestId("feed-list")).toBeNull();

      await fireEvent.press(screen.getByRole("button", { name: "Feed" }));

      expect(await screen.findByTestId("feed-list")).toBeVisible();
      expect(screen).toHaveSearchParams({ view: "feed" });
      // The list leaves room for the row with the segmented control drawn over it.
      expect(StyleSheet.flatten(screen.getByTestId("feed-list").props.contentContainerStyle).paddingTop).toBeGreaterThan(0);
      // In Feed the filter pill goes away (the map behind it is not what you are looking at).
      expect(screen.queryByText("Filtros")).toBeNull();
      expect(screen.queryByRole("menuitem", { name: "Todos" })).toBeNull();
    });

    it("going back to Mapa does not mount the map again", async () => {
      await renderRouter(routes, { initialUrl: "/map" });
      await screen.findByRole("button", { name: "Feed" });
      expect(mapMounts.current).toBe(1);

      await fireEvent.press(screen.getByRole("button", { name: "Feed" }));
      await screen.findByTestId("feed-list");
      await fireEvent.press(mapSegment());

      await waitFor(() => expect(screen.queryByTestId("feed-list")).toBeNull());
      expect(screen).toHaveSearchParams({ view: "map" });
      expect(screen.getByLabelText("mapa")).toBeVisible();
      expect(mapMounts.current).toBe(1);
    });
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
        feedItem({ id: "tarde", takenAt: Date.parse("2027-01-12T20:00:00Z"), author: { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null } }),
        feedItem({ id: "temprano", takenAt: Date.parse("2027-01-12T15:00:00Z"), author: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null }, caption: "primera" }),
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

  it("tapping the author on the card opens their profile, without opening the photo", async () => {
    mocked.fetchTrip.mockResolvedValue({ ...detail(), trip: { ...detail().trip, revealed: true, endsAt: Date.now() - DAY } });
    mocked.fetchFeed.mockResolvedValue({
      ...feed([feedItem({ files: { thumb: "/media/f1/thumb", original: "/media/f1/original" } })]),
      revealed: true,
    });
    await renderRouter(
      { ...routes, "photo/[id]": () => <Text>Foto</Text>, "user/[id]": () => <Text>Perfil de alguien</Text> },
      { initialUrl: "/map" },
    );

    await fireEvent.press(await screen.findByLabelText("pin f1"));
    await fireEvent.press(await screen.findByRole("button", { name: "Perfil de Fede" }));

    expect(await screen.findByText("Perfil de alguien")).toBeVisible();
    expect(screen).toHavePathname("/user/u-m2");
    expect(screen.queryByText("Foto")).toBeNull();
  });

  it("tapping your own name on the card goes to Perfil", async () => {
    await signInAs({ user: { ...USER, id: "u-m1" }, trips: [tripSummary(SUR, "Viaje al sur")] });
    mocked.fetchTrip.mockResolvedValue(detail());
    mocked.fetchFeed.mockResolvedValue(feed([feedItem({ author: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null } })]));
    await renderRouter(routes, { initialUrl: "/map" });

    await fireEvent.press(await screen.findByLabelText("pin f1"));
    await fireEvent.press(await screen.findByRole("button", { name: "Perfil de Juani" }));

    await waitFor(() => expect(screen).toHavePathname("/me"));
  });
});
