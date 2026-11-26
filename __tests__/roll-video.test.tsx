import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { router } from "expo-router";
import { Text } from "react-native";
import "@/test/reanimated";
import * as filmHook from "@/features/journey/use-film";
import * as sheetHook from "@/features/journey/use-sheet-film";
import { setFilmSelection } from "@/features/share/film-selection";
import { setSheetChoices } from "@/features/share/sheet-selection";
import * as actions from "@/features/trips/actions";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";
import { keepOriginals } from "@/test/trip";

jest.mock("@/features/trips/actions");
let mockVideoAvailable = true;
jest.mock("../modules/rollo-video", () => ({
  get videoAvailable() {
    return mockVideoAvailable;
  },
  cancelVideo: jest.fn(),
}));
const mocked = jest.mocked(actions);
const useFilm = jest.mocked(filmHook.useFilm);
const useSheetFilm = jest.mocked(sheetHook.useSheetFilm);

const SUR = "11111111-1111-4111-8111-111111111111";
const DAY = 24 * 60 * 60 * 1000;

const detail = (over: Partial<actions.Trip> = {}): actions.TripDetail => {
  const me = { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin" as const, isCreator: false, blockedByMe: false, groupIds: [] };
  return {
    trip: {
      id: SUR,
      name: "Viaje al sur",
      joinCode: "HUB5FT",
      timezone: "America/Argentina/Buenos_Aires",
      startsAt: Date.now() - 9 * DAY,
      endsAt: Date.now() - 2 * DAY,
      revealAt: Date.now() - DAY,
      revealed: true,
      dailyPhotoLimit: 10,
      dailyVideoLimit: 3,
      featuringDisabled: false,
      maxMembers: 15,
      photoLimitMode: "daily",
      totalPhotoLimit: null,
      momentMode: "off",
      momentWindowStart: 540,
      momentWindowEnd: 1380,
      originals: keepOriginals,
      description: null,
      contest: null,
      type: "trip",
      coverUrl: null,
      coverFocusY: null,
      groups: [],
      createdBy: null,
      ...over,
    },
    me,
    members: [me],
    memberCount: 1,
    today: { date: "2027-01-12", photosLeft: 7, videosLeft: 2 },
    totalUploaded: 10,
  };
};

const item = (id: string, over: Partial<actions.Feed["items"][number]> = {}): actions.Feed["items"][number] => ({
  groupIds: [],
  id,
  type: "photo",
  takenAt: Date.parse("2027-01-12T16:10:00Z"),
  day: "2027-01-12",
  lat: null,
  lng: null,
  caption: null,
  thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
  durationS: null,
  author: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null },
  width: 4000,
  height: 3000,
  shareable: true,
  files: { thumb: `/m/${id}/thumb`, original: `/m/${id}/original` },
  ...over,
});
const feed = (items: actions.Feed["items"]): actions.Feed => ({ revealed: true, revealAt: Date.now() - DAY, items, nextCursor: null });
const at = (id: string, lat: number, lng: number) => item(id, { lat, lng });
const TWO_PLACES = [at("a", -41.13, -71.31), at("b", -41.14, -71.32), at("c", -42.9, -71.3), at("d", -42.91, -71.31)];
const filler = (n: number) => Array.from({ length: n }, (_, i) => item(`f${String(i).padStart(2, "0")}`, { takenAt: Date.parse("2027-01-12T16:10:00Z") + i * 60_000 }));

const routeReady = { status: "ready", film: { kind: "route", scene: {}, assets: {}, durationMs: 30_000, restAt: 0, version: "r1" }, stops: [], photos: [] } as unknown as filmHook.Film;
const sheetReady = { status: "ready", film: { kind: "sheet", scene: {}, assets: {}, durationMs: 40_000, restAt: 0, version: "s1" }, photos: [] } as unknown as sheetHook.SheetFilm;

const player = {
  ...routes,
  start: () => <Text>start stub</Text>,
  "share-story": () => <Text>share stub</Text>,
};
async function open(kind: string, d = detail(), items: actions.Feed["items"] = [...TWO_PLACES, ...filler(6)]) {
  mocked.fetchTrip.mockResolvedValue(d);
  mocked.fetchFeedPage.mockResolvedValue(feed(items));
  await renderRouter(player, { initialUrl: "/start" });
  await act(async () => router.push({ pathname: "/roll-video", params: { tripId: SUR, kind } }));
}

beforeEach(async () => {
  mockVideoAvailable = true;
  setFilmSelection(SUR, []);
  setSheetChoices(SUR, {});
  mocked.fetchTrip.mockReset();
  mocked.fetchFeedPage.mockReset();
  useFilm.mockReset().mockReturnValue(routeReady);
  useSheetFilm.mockReset().mockReturnValue(sheetReady);
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
});

describe("Roll video player", () => {
  it("plays the route film in the player, with Cerrar and Compartir", async () => {
    await open("route");
    expect(await screen.findByTestId("film-player")).toHaveProp("accessibilityLabel", "playing");
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Compartir" })).toBeVisible();
    expect(useSheetFilm.mock.calls.length).toBe(0);
  });

  it("plays the summary film when opened with sheet", async () => {
    await open("sheet");
    expect(await screen.findByTestId("film-player")).toBeVisible();
    expect(useFilm.mock.calls.length).toBe(0);
  });

  it("shows only a spinner while the film is loading", async () => {
    useFilm.mockReturnValue({ status: "loading", done: 0, total: 0 });
    await open("route");
    await waitFor(() => expect(useFilm).toHaveBeenCalled());
    expect(screen.queryByTestId("film-player")).toBeNull();
    expect(screen.getByLabelText("Armando el video")).toBeVisible();
    expect(screen.queryByText(/Armando/)).toBeNull();
  });

  it("says the film could not be built, and retries", async () => {
    const retry = jest.fn();
    useFilm.mockReturnValue({ status: "error", offline: false, retry });
    await open("route");
    expect(await screen.findByText("No se pudo armar el video.")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("says there is no connection when offline", async () => {
    useFilm.mockReturnValue({ status: "error", offline: true, retry: jest.fn() });
    await open("route");
    expect(await screen.findByText("Sin conexión no se puede armar el video.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });

  it("says the roll has no video when the route film is no-route", async () => {
    useFilm.mockReturnValue({ status: "no-route" });
    await open("route");
    expect(await screen.findByText("Este rollo todavía no tiene video.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeVisible();
  });

  it("says the roll has no video when the summary film is few", async () => {
    useSheetFilm.mockReturnValue({ status: "few" });
    await open("sheet");
    expect(await screen.findByText("Este rollo todavía no tiene video.")).toBeVisible();
  });

  it("says the roll has no video when the kind is not available", async () => {
    await open("route", detail(), filler(8));
    expect(await screen.findByText("Este rollo todavía no tiene video.")).toBeVisible();
    expect(screen.queryByTestId("film-player")).toBeNull();
  });

  it("says the roll has no video for an unknown kind", async () => {
    await open("collage");
    expect(await screen.findByText("Este rollo todavía no tiene video.")).toBeVisible();
  });

  it("Cerrar goes back", async () => {
    await open("route");
    await fireEvent.press(await screen.findByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen).toHavePathname("/start"));
  });

  it("the Cerrar of the empty state goes back too", async () => {
    await open("route", detail(), filler(8));
    await fireEvent.press(await screen.findByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen).toHavePathname("/start"));
  });

  it("Compartir replaces the player with the share screen on the route", async () => {
    await open("route");
    await fireEvent.press(await screen.findByRole("button", { name: "Compartir" }));
    await waitFor(() => expect(screen).toHavePathname("/share-story"));
    expect(screen).toHaveSearchParams({ tripId: SUR, kind: "journey" });
    expect(await screen.findByText("share stub")).toBeVisible();
    // replaced: going back does not return to the player
    await act(async () => router.back());
    expect(screen).toHavePathname("/start");
  });

  it("Compartir opens the summary when playing the summary", async () => {
    await open("sheet");
    await fireEvent.press(await screen.findByRole("button", { name: "Compartir" }));
    await waitFor(() => expect(screen).toHavePathname("/share-story"));
    expect(screen).toHaveSearchParams({ tripId: SUR, kind: "sheet" });
  });
});
