import { act } from "@testing-library/react-native";
import { ActionSheetIOS, Alert, Text } from "react-native";
import * as sections from "@/features/feed/sections";
import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import "@/test/reanimated";
import { createQueue, type Queue, type QueuedMedia } from "@/features/capture/queue";
import * as actions from "@/features/trips/actions";
import { signInAs, tripSummary, USER } from "@/test/account";
import { memoryDb } from "@/test/sqlite-memory";
import { routes } from "@/test/routes";
import * as featuredActions from "@/features/featured/actions";
import * as moderationActions from "@/features/moderation/actions";
import * as Burnt from "burnt";

jest.mock("@/features/trips/actions");
jest.mock("@/features/moderation/actions");
// Perfil is mounted too: nobody has featured photos, so its own "Reintentar" stays out of the way.
jest.mock("@/features/featured/actions");
beforeEach(() => {
  jest.mocked(featuredActions).fetchFeatured.mockResolvedValue([]);
});
const mocked = jest.mocked(actions);
const moderation = jest.mocked(moderationActions);
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
    featuringDisabled: false,
    maxMembers: 15,
    photoLimitMode: "daily",
    totalPhotoLimit: null,
    momentMode: "off",
    momentWindowStart: 540,
    momentWindowEnd: 1380,
    createdBy: null,
  },
  me: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role, isCreator: false, blockedByMe: false },
  members: [
    { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role, isCreator: false, blockedByMe: false },
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

const feed = (items: actions.Feed["items"]): actions.Feed => ({ revealed: false, revealAt: Date.now() + DAY, items, nextCursor: null });

const queued = (over: Partial<QueuedMedia> = {}): QueuedMedia => ({
  id: "q1",
  tripId: SUR,
  ownerUserId: "u1",
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
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success" },
}));

beforeEach(async () => {
  mocked.fetchTrip.mockResolvedValue(detail());
  mocked.fetchFeedPage.mockResolvedValue(feed([]));
  mocked.deleteMedia.mockResolvedValue(undefined);
  sheet.mockClear();
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur", { role: "admin" })] });
  queue = await createQueue(memoryDb());
  getQueue.mockImplementation(() => Promise.resolve(queue));
});

afterEach(() => alert.mockRestore());

describe("Feed", () => {
  it("groups by day, newest to oldest, with the latest of each day first", async () => {
    mocked.fetchFeedPage.mockResolvedValue(
      feed([
        feedItem({ id: "a", day: "2027-01-11", takenAt: Date.parse("2027-01-11T15:00:00Z"), caption: "ayer vieja" }),
        feedItem({ id: "b", takenAt: Date.parse("2027-01-12T15:00:00Z"), caption: "temprano" }),
        feedItem({ id: "c", takenAt: Date.parse("2027-01-12T20:00:00Z"), caption: "tarde" }),
      ]),
    );
    await renderRouter(routes, { initialUrl: "/map?view=feed" });

    await screen.findByText("tarde");
    const texts = screen.getAllByText(/^(Martes 12|Lunes 11|tarde|temprano|ayer vieja)$/).map((n) => n.props.children);
    expect(texts).toEqual(["Martes 12", "tarde", "temprano", "Lunes 11", "ayer vieja"]);
  });

  it("names the author by handle, falling back to the name when there is none", async () => {
    mocked.fetchFeedPage.mockResolvedValue(
      feed([
        feedItem({ id: "a", caption: null, author: { id: "m2", userId: "u-m2", name: "Fede", username: "fede.s", avatarUrl: null } }),
        feedItem({ id: "b", caption: null, author: { id: "m3", userId: "u-m3", name: "Cami", username: null, avatarUrl: null } }),
      ]),
    );
    await renderRouter(routes, { initialUrl: "/map?view=feed" });

    const rows = await screen.findAllByTestId("feed-row");
    expect(within(rows[0]!).getByText("@fede.s")).toBeVisible();
    expect(within(rows[0]!).queryByText("Fede")).toBeNull();
    expect(within(rows[1]!).getByText("Cami")).toBeVisible();
  });

  it("your unuploaded photos go in their day with 'Esperando señal'", async () => {
    await queue.enqueue(queued());
    await renderRouter(routes, { initialUrl: "/map?view=feed" });

    expect(await screen.findByText("Esperando señal")).toBeVisible();
    expect(within(screen.getByTestId("feed-row")).getByText("Juani")).toBeVisible();
    expect(screen.getByText("Martes 12")).toBeVisible();
  });

  it("tapping a row with a location switches to Mapa centered on that photo", async () => {
    mocked.fetchFeedPage.mockResolvedValue(feed([feedItem()]));
    await renderRouter(routes, { initialUrl: "/map?view=feed" });

    await fireEvent.press(await screen.findByRole("button", { name: /^Fede, / }));

    // Same tab: the view switches to Mapa and the (already mounted) map flies to the photo and opens its card.
    await waitFor(() => expect(screen.queryByTestId("feed-list")).toBeNull());
    expect(screen).toHavePathname("/map");
    expect(screen).toHaveSearchParams({ view: "map" });
    await waitFor(() => expect(camera.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [-72.89, -49.33], zoom: 15 })));
    // The list is gone, so the caption on screen is the pin's card.
    expect(await screen.findByText("el viento no perdona")).toBeVisible();
  });

  describe("daily moments", () => {
    const moment = (over: Partial<actions.Feed["items"][number]> = {}) =>
      feedItem({ id: "mo1", momentDay: "2027-01-12", caption: "mi momento", files: { thumb: "/media/mo1/thumb", original: "/media/mo1/original" }, width: 1080, height: 1440, ...over });

    it("shows the real photo with the moment badge instead of the thumbhash, and keeps ordinary rows blurry", async () => {
      mocked.fetchFeedPage.mockResolvedValue(feed([moment(), feedItem({ id: "n1", caption: "normal", takenAt: Date.parse("2027-01-12T15:00:00Z") })]));
      await renderRouter(routes, { initialUrl: "/map?view=feed" });

      const rows = await screen.findAllByTestId("feed-row");
      await waitFor(() => expect(within(rows[0]!).getByTestId("feed-thumb").props.source).toEqual([expect.objectContaining({ uri: expect.stringContaining("/media/mo1/thumb") })]));
      expect(within(rows[0]!).getByTestId("moment-badge")).toBeVisible();
      expect(within(rows[1]!).getByTestId("feed-thumb").props.source).toEqual([]);
      expect(within(rows[1]!).queryByTestId("moment-badge")).toBeNull();
    });

    it("tapping a moment opens the viewer for that photo in this roll, not the map", async () => {
      mocked.fetchFeedPage.mockResolvedValue(feed([moment()]));
      await renderRouter({ ...routes, "photo/[id]": () => <Text>Foto</Text> }, { initialUrl: "/map?view=feed" });

      const row = await screen.findByRole("button", { name: /^Fede, / });
      camera.flyTo.mockClear();
      await fireEvent.press(row);

      expect(await screen.findByText("Foto")).toBeVisible();
      expect(screen).toHavePathname("/photo/mo1");
      expect(screen).toHaveSearchParams({ id: "mo1", tripId: SUR });
      expect(camera.flyTo).not.toHaveBeenCalled();
    });
  });

  it("tapping the author's photo or name opens their profile instead of the map", async () => {
    mocked.fetchFeedPage.mockResolvedValue(feed([feedItem()]));
    await renderRouter({ ...routes, "user/[id]": () => <Text>Perfil de alguien</Text> }, { initialUrl: "/map?view=feed" });

    const author = await screen.findByRole("button", { name: "Perfil de Fede" });
    camera.flyTo.mockClear();
    await fireEvent.press(author);

    expect(await screen.findByText("Perfil de alguien")).toBeVisible();
    expect(screen).toHavePathname("/user/u-m2");
    expect(camera.flyTo).not.toHaveBeenCalled();
  });

  it("tapping your own name (also on an unuploaded photo) goes to Perfil", async () => {
    await signInAs({ user: { ...USER, id: "u-m1" }, trips: [tripSummary(SUR, "Viaje al sur", { role: "admin" })] });
    await queue.enqueue(queued({ ownerUserId: "u-m1" }));
    await renderRouter(routes, { initialUrl: "/map?view=feed" });

    await fireEvent.press(await screen.findByRole("button", { name: "Perfil de Juani" }));

    await waitFor(() => expect(screen).toHavePathname("/me"));
  });

  it("a row without a location is not tappable", async () => {
    mocked.fetchFeedPage.mockResolvedValue(feed([feedItem({ lat: null, lng: null })]));
    await renderRouter(routes, { initialUrl: "/map?view=feed" });

    await screen.findByText("el viento no perdona");
    expect(screen.queryByRole("button", { name: /^Fede, / })).toBeNull();
  });

  it("pull to refresh requests the feed again", async () => {
    await renderRouter(routes, { initialUrl: "/map?view=feed" });
    await screen.findByText(EMPTY);
    mocked.fetchFeedPage.mockClear();

    await act(async () => {
      await screen.getByTestId("feed-list").props.refreshControl.props.onRefresh();
    });

    expect(mocked.fetchFeedPage).toHaveBeenCalledTimes(1);
  });

  it("does not recompute the grouping on every render", async () => {
    mocked.fetchFeedPage.mockResolvedValue(feed([feedItem()]));
    const group = jest.spyOn(sections, "groupByDay");
    await renderRouter(routes, { initialUrl: "/map?view=feed" });
    await screen.findByText("el viento no perdona");
    const before = group.mock.calls.length;

    // Refreshing changes the screen state (re-render) but not the data.
    await act(async () => {
      await screen.getByTestId("feed-list").props.refreshControl.props.onRefresh();
    });

    expect(group.mock.calls.length).toBe(before);
    group.mockRestore();
  });

  describe("paging (newest first, 30 at a time)", () => {
    // The host does not expose the list props: walk up to the SectionList.
    const list = () => {
      let node: { props: Record<string, any>; parent: any } | null = screen.getByTestId("feed-list");
      while (node && !node.props.onEndReached) node = node.parent;
      return node!.props;
    };
    const rowIds = () =>
      ((list().sections ?? list().data) as { data: { id: string }[] }[]).flatMap((s) => s.data.map((i) => i.id));
    const sectionTitles = () => ((list().sections ?? list().data) as { title: string }[]).map((s) => s.title);
    const at = (iso: string) => Date.parse(iso);
    const item = (id: string, iso: string, day: string) => feedItem({ id, takenAt: at(iso), day, caption: `foto ${id}` });
    beforeEach(() => mocked.fetchFeedPage.mockClear());
    const descCalls = () => mocked.fetchFeedPage.mock.calls.filter(([, opts]) => opts.order === "desc");

    /** Newest first pages for the feed, and the map's own oldest-first walk (empty here). */
    function serve(pages: Record<string, actions.Feed>) {
      mocked.fetchFeedPage.mockImplementation(async (_trip, { cursor, order }) => (order === "desc" ? pages[cursor ?? ""]! : feed([])));
    }
    const page1 = (nextCursor: string | null = "c1"): actions.Feed => ({
      ...feed([item("n2", "2027-01-12T20:00:00Z", "2027-01-12"), item("n1", "2027-01-12T15:00:00Z", "2027-01-12")]),
      nextCursor,
    });
    const page2 = (nextCursor: string | null = null): actions.Feed => ({
      ...feed([item("o2", "2027-01-12T10:00:00Z", "2027-01-12"), item("o1", "2027-01-11T15:00:00Z", "2027-01-11")]),
      nextCursor,
    });

    it("asks for newest first, 30 per page, and shows only the first page", async () => {
      serve({ "": page1(), c1: page2() });
      await renderRouter(routes, { initialUrl: "/map?view=feed" });

      await screen.findByText("foto n2");
      expect(descCalls()).toEqual([[SUR, { cursor: undefined, limit: 30, order: "desc" }]]);
      expect(rowIds()).toEqual(["n2", "n1"]);
      expect(screen.queryByText("foto o2")).toBeNull();
    });

    it("reaching the end loads the next page with the same order and appends it, grouped by day", async () => {
      serve({ "": page1(), c1: page2() });
      await renderRouter(routes, { initialUrl: "/map?view=feed" });
      await screen.findByText("foto n2");

      await act(async () => list().onEndReached());

      await waitFor(() => expect(rowIds()).toEqual(["n2", "n1", "o2", "o1"]));
      expect(descCalls().at(-1)).toEqual([SUR, { cursor: "c1", limit: 30, order: "desc" }]);
      // The second page continues the same day (one section) and then starts an older one.
      expect(sectionTitles()).toEqual(["Martes 12", "Lunes 11"]);
      // Nothing more to load: another end reached asks for nothing.
      const calls = mocked.fetchFeedPage.mock.calls.length;
      await act(async () => list().onEndReached());
      expect(mocked.fetchFeedPage.mock.calls.length).toBe(calls);
    });

    it("shows a spinner at the end while the next page loads", async () => {
      serve({ "": page1() });
      await renderRouter(routes, { initialUrl: "/map?view=feed" });
      await screen.findByText("foto n2");
      mocked.fetchFeedPage.mockImplementation(() => new Promise(() => {}));

      await act(async () => list().onEndReached());

      expect(await screen.findByTestId("feed-loading-more")).toBeTruthy();
    });

    it("a failed next page keeps what is loaded and offers Reintentar at the end", async () => {
      serve({ "": page1() });
      await renderRouter(routes, { initialUrl: "/map?view=feed" });
      await screen.findByText("foto n2");
      mocked.fetchFeedPage.mockRejectedValue(new Error("Sin señal"));

      await act(async () => list().onEndReached());

      expect(await screen.findByText("No se pudieron cargar más fotos.")).toBeVisible();
      expect(screen.getByText("foto n2")).toBeVisible();
      // While the error stands, reaching the end does not hammer the server.
      const calls = mocked.fetchFeedPage.mock.calls.length;
      await act(async () => list().onEndReached());
      expect(mocked.fetchFeedPage.mock.calls.length).toBe(calls);

      serve({ "": page1(), c1: page2() });
      await fireEvent.press(within(screen.getByTestId("feed-list")).getByRole("button", { name: "Reintentar" }));

      await waitFor(() => expect(rowIds()).toEqual(["n2", "n1", "o2", "o1"]));
      expect(screen.queryByText("No se pudieron cargar más fotos.")).toBeNull();
    });

    it("does not say it is empty while there are more pages", async () => {
      // An empty first page that still points to a next one (the next page never answers here).
      mocked.fetchFeedPage.mockImplementation(async (_trip, { cursor, order }) =>
        order !== "desc" ? feed([]) : cursor ? new Promise<actions.Feed>(() => {}) : { ...feed([]), nextCursor: "c1" },
      );
      await renderRouter(routes, { initialUrl: "/map?view=feed" });

      await waitFor(() => expect(descCalls().length).toBeGreaterThan(0));
      await waitFor(() => expect(screen.queryByTestId("feed-loading")).toBeNull());
      expect(screen.queryByText(EMPTY)).toBeNull();
    });

    it("tapping a row still focuses that pin on the map (which loads oldest first)", async () => {
      const here = feedItem({ id: "f1", caption: "el viento no perdona" });
      mocked.fetchFeedPage.mockImplementation(async () => ({ ...feed([here]), nextCursor: null }));
      await renderRouter(routes, { initialUrl: "/map?view=feed" });

      await fireEvent.press(await screen.findByRole("button", { name: /^Fede, / }));

      await waitFor(() => expect(camera.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [-72.89, -49.33], zoom: 15 })));
      expect(mocked.fetchFeedPage.mock.calls.some(([, o]) => o.order === undefined)).toBe(true);
      expect(mocked.fetchFeedPage.mock.calls.some(([, o]) => o.order === "desc")).toBe(true);
    });
  });

  describe("reporting", () => {
    // The row's own sheet picks `label`, then the reason sheet picks index 0 ("Es ofensivo").
    const pickReport = () =>
      sheet.mockImplementation((opts, cb) => {
        if (opts.options.includes("Denunciar")) cb(opts.options.indexOf("Denunciar"));
        else cb(0);
      });
    afterEach(() => sheet.mockImplementation(() => {}));

    it("long-pressing someone else's row reports it and the row disappears", async () => {
      mocked.fetchFeedPage.mockResolvedValue(feed([feedItem()]));
      // Like the server: once reported, the item is gone from the refetched feed too.
      moderation.reportMedia.mockImplementation(async () => {
        mocked.fetchFeedPage.mockResolvedValue(feed([]));
      });
      await renderRouter(routes, { initialUrl: "/map?view=feed" });
      await screen.findByText("el viento no perdona");
      pickReport();

      await fireEvent(screen.getByLabelText(/^Fede, /), "longPress");

      await waitFor(() => expect(moderation.reportMedia).toHaveBeenCalledWith("f1", "offensive"));
      await waitFor(() => expect(screen.queryByText("el viento no perdona")).toBeNull());
    });

    it("your own rows offer no Denunciar", async () => {
      mocked.fetchFeedPage.mockResolvedValue(
        feed([feedItem({ author: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null } })]),
      );
      await renderRouter(routes, { initialUrl: "/map?view=feed" });
      await screen.findByText("el viento no perdona");

      await fireEvent(screen.getByLabelText(/^Juani, /), "longPress");

      expect(sheet.mock.calls[0]![0].options).toEqual(["Borrar foto", "Cancelar"]);
    });

    it("a member sees Denunciar but not Borrar foto on someone else's row", async () => {
      mocked.fetchTrip.mockResolvedValue(detail("member"));
      mocked.fetchFeedPage.mockResolvedValue(feed([feedItem()]));
      await renderRouter(routes, { initialUrl: "/map?view=feed" });
      await screen.findByText("el viento no perdona");

      await fireEvent(screen.getByLabelText(/^Fede, /), "longPress");

      expect(sheet.mock.calls[0]![0].options).toEqual(["Denunciar", "Cancelar"]);
    });

    it("a failed report keeps the row and shows the error HUD", async () => {
      moderation.reportMedia.mockRejectedValue(new Error("sin señal"));
      mocked.fetchFeedPage.mockResolvedValue(feed([feedItem()]));
      await renderRouter(routes, { initialUrl: "/map?view=feed" });
      await screen.findByText("el viento no perdona");
      pickReport();

      await fireEvent(screen.getByLabelText(/^Fede, /), "longPress");

      await waitFor(() => expect(Burnt.alert).toHaveBeenCalledWith(expect.objectContaining({ preset: "error" })));
      expect(screen.getByText("el viento no perdona")).toBeVisible();
    });
  });

  describe("admin", () => {
    it("Borrar foto asks for confirmation and, if confirmed, deletes and refetches feed and trip", async () => {
      mocked.fetchFeedPage.mockResolvedValue(feed([feedItem()]));
      await renderRouter(routes, { initialUrl: "/map?view=feed" });
      await screen.findByText("el viento no perdona");
      mocked.fetchFeedPage.mockClear();
      mocked.fetchTrip.mockClear();

      await fireEvent(screen.getByLabelText(/^Fede, /), "longPress");
      sheet.mock.calls[0]![1](1);

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

      expect(mocked.deleteMedia).toHaveBeenCalledWith("f1");
      await waitFor(() => expect(mocked.fetchFeedPage).toHaveBeenCalled());
      await waitFor(() => expect(mocked.fetchTrip).toHaveBeenCalled());
    });

    it("if the server rejects, it shows an alert with its message", async () => {
      mocked.fetchFeedPage.mockResolvedValue(feed([feedItem()]));
      mocked.deleteMedia.mockRejectedValue(new Error("El viaje ya se reveló"));
      await renderRouter(routes, { initialUrl: "/map?view=feed" });
      await screen.findByText("el viento no perdona");

      await fireEvent(screen.getByLabelText(/^Fede, /), "longPress");
      sheet.mock.calls[0]![1](1);
      const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
      await act(async () => buttons.find((b) => b.text === "Borrar")!.onPress!());

      await waitFor(() => expect(alert).toHaveBeenLastCalledWith("No se pudo borrar", "El viaje ya se reveló"));
    });

    it("a pending photo cannot be deleted", async () => {
      await queue.enqueue(queued());
      await renderRouter(routes, { initialUrl: "/map?view=feed" });

      await screen.findByText("Esperando señal");
      await fireEvent(within(screen.getByTestId("feed-row")).getByText("Juani"), "longPress");
      expect(sheet).not.toHaveBeenCalled();
    });
  });

  it("a non-admin member cannot delete", async () => {
    mocked.fetchTrip.mockResolvedValue(detail("member"));
    mocked.fetchFeedPage.mockResolvedValue(feed([feedItem()]));
    await renderRouter(routes, { initialUrl: "/map?view=feed" });

    await screen.findByText("el viento no perdona");
    await fireEvent(within(screen.getByTestId("feed-row")).getByText("Fede"), "longPress");
    expect(sheet.mock.calls.flatMap((c) => c[0].options)).not.toContain("Borrar foto");
  });

  it("with no photos it explains they will show up here", async () => {
    await renderRouter(routes, { initialUrl: "/map?view=feed" });
    expect(await screen.findByText(EMPTY)).toBeVisible();
  });

  it("while loading it shows a small indicator, not the empty state", async () => {
    mocked.fetchFeedPage.mockReturnValue(new Promise(() => {}));
    await renderRouter(routes, { initialUrl: "/map?view=feed" });

    expect(await screen.findByTestId("feed-loading")).toBeTruthy();
    expect(screen.queryByText(EMPTY)).toBeNull();
  });

  it("if it fails with no cache it shows the error with Reintentar", async () => {
    mocked.fetchFeedPage.mockRejectedValueOnce(new Error("Sin conexión"));
    await renderRouter(routes, { initialUrl: "/map?view=feed" });

    expect((await screen.findAllByText("Sin conexión"))[0]).toBeVisible();
    mocked.fetchFeedPage.mockResolvedValue(feed([feedItem()]));
    await fireEvent.press(screen.getAllByRole("button", { name: "Reintentar" }).at(-1)!);

    expect(await screen.findByText("el viento no perdona")).toBeVisible();
    expect(screen.queryByText("Sin conexión")).toBeNull();
  });
});
