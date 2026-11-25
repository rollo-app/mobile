import * as Clipboard from "expo-clipboard";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import "@/test/reanimated";
import * as renderCollageModule from "@/features/share/render-collage";
import * as renderInviteModule from "@/features/share/render-invite";
import * as shareStory from "@/features/share/share-story";
import * as tripActions from "@/features/trips/actions";
import { keepOriginals } from "@/test/trip";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/share/render-collage", () => ({ renderCollage: jest.fn() }));
jest.mock("@/features/share/render-invite", () => ({ renderInvite: jest.fn() }));
jest.mock("@/features/share/share-story", () => ({
  ...jest.requireActual("@/features/share/share-story"),
  writeStoryFile: jest.fn(),
  instagramStoriesAvailable: jest.fn(),
  shareToInstagramStories: jest.fn(),
  shareMore: jest.fn(),
}));
const trips = jest.mocked(tripActions);
const collage = jest.mocked(renderCollageModule.renderCollage);
const invite = jest.mocked(renderInviteModule.renderInvite);
const story = jest.mocked(shareStory);
const clipboard = jest.mocked(Clipboard);

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";
const FILE = "file:///cache/rollo-story.jpg";

const detail = (over: Partial<tripActions.Trip> = {}): tripActions.TripDetail => {
  const me = { id: "m1", userId: "u1", name: "Juani", username: "juani", avatarUrl: null, role: "admin" as const, isCreator: true, blockedByMe: false, groupIds: [] };
  return {
    trip: {
      id: SUR,
      name: "Viaje al sur",
      joinCode: "HUB5FT",
      timezone: "America/Argentina/Buenos_Aires",
      startsAt: Date.parse("2027-01-03T15:00:00Z"),
      endsAt: Date.parse("2027-01-09T15:00:00Z"),
      revealAt: Date.parse("2027-01-09T15:00:00Z"),
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
      originals: keepOriginals,
      description: null,
      contest: null,
      type: "trip",
      coverUrl: null,
      groups: [],
      createdBy: { userId: "u1", name: "Juani" },
      ...over,
    },
    me,
    members: [me],
    memberCount: 1,
    today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
    totalUploaded: 3,
  };
};

const item = (id: string, over: Partial<tripActions.Feed["items"][number]> = {}): tripActions.Feed["items"][number] => ({
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
  author: { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null },
  width: 4000,
  height: 3000,
  shareable: true,
  files: { thumb: `/m/${id}/thumb`, original: `/m/${id}/original` },
  ...over,
});

const feed = (items: tripActions.Feed["items"], revealed = true): tripActions.Feed => ({ revealed, revealAt: Date.now() - DAY, items, nextCursor: null });

async function open(kind: "collage" | "invite", d = detail(), items = [item("a"), item("b")]) {
  trips.fetchTrip.mockResolvedValue(d);
  trips.fetchFeedPage.mockResolvedValue(feed(items, d.trip.revealed));
  await renderRouter(routes, { initialUrl: `/share-story?tripId=${SUR}&kind=${kind}` });
}

const heroes = () => collage.mock.calls.map(([input]) => input.photos[0]?.id);

beforeEach(async () => {
  jest.clearAllMocks();
  for (const mock of Object.values(trips)) (mock as Partial<jest.Mock>).mockReset?.();
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
  collage.mockResolvedValue(new Uint8Array([1]));
  invite.mockResolvedValue(new Uint8Array([2]));
  story.writeStoryFile.mockResolvedValue(FILE);
  story.instagramStoriesAvailable.mockResolvedValue(true);
  story.shareToInstagramStories.mockResolvedValue(undefined);
  story.shareMore.mockResolvedValue(undefined);
});

describe("Compartir screen", () => {
  it("collage: shows the preview, Compartir en Stories and Otras; Otras rebuilds with a new seed", async () => {
    await open("collage");
    expect(await screen.findByLabelText("Vista previa")).toBeVisible();
    expect(await screen.findByRole("button", { name: "Compartir en Stories" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Más opciones" })).toBeVisible();
    expect(collage).toHaveBeenCalledTimes(1);
    expect(collage.mock.calls[0]![0]).toMatchObject({ name: "Viaje al sur", caption: "3 – 9 de enero · 1 persona" });

    await fireEvent.press(screen.getByRole("button", { name: "Otras" }));
    await waitFor(() => expect(collage).toHaveBeenCalledTimes(2));
    // With two candidates, "Otras" must change the hero (the first photo), not just the order of the rest.
    const [first, second] = heroes();
    expect(second).not.toBe(first);
  });

  it("collage without Instagram: only Más opciones", async () => {
    story.instagramStoriesAvailable.mockResolvedValue(false);
    await open("collage");
    expect(await screen.findByLabelText("Vista previa")).toBeVisible();
    expect(screen.getByRole("button", { name: "Más opciones" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Compartir en Stories" })).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Más opciones" }));
    await waitFor(() => expect(story.shareMore).toHaveBeenCalledWith(FILE, undefined));
  });

  it("collage with a single shareable photo has no Otras", async () => {
    await open("collage", detail(), [item("a"), item("b", { shareable: false })]);
    expect(await screen.findByLabelText("Vista previa")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Otras" })).toBeNull();
  });

  it("invite: copies the link before opening Stories and shows the sticker note", async () => {
    const order: string[] = [];
    clipboard.setStringAsync.mockImplementation(async () => (order.push("copy"), true));
    story.shareToInstagramStories.mockImplementation(async () => void order.push("stories"));
    await open("invite", detail(), [item("a", { shareable: false })]);
    expect(await screen.findByLabelText("Vista previa")).toBeVisible();
    expect(screen.getByText("Copiamos el link. Pegalo en tu story con el sticker de Enlace")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Otras" })).toBeNull();
    expect(invite).toHaveBeenCalledWith(expect.objectContaining({ name: "Viaje al sur", code: "HUB5FT", coverUrl: null }));
    expect(invite.mock.calls[0]![0].swatches.length).toBeGreaterThan(0);

    await fireEvent.press(await screen.findByRole("button", { name: "Compartir en Stories" }));
    await waitFor(() => expect(story.shareToInstagramStories).toHaveBeenCalledWith(FILE));
    expect(clipboard.setStringAsync).toHaveBeenCalledWith(expect.stringContaining("HUB5FT"));
    expect(order).toEqual(["copy", "stories"]);

    await fireEvent.press(screen.getByRole("button", { name: "Más opciones" }));
    await waitFor(() => expect(story.shareMore).toHaveBeenCalledWith(FILE, expect.stringContaining("HUB5FT")));
    expect(clipboard.setStringAsync).toHaveBeenCalledTimes(2);
  });

  it("render failure shows the error and Reintentar rebuilds", async () => {
    collage.mockRejectedValueOnce(new Error("skia"));
    await open("collage");
    expect(await screen.findByText("No se pudo armar la imagen. Probá de nuevo.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Más opciones" })).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByLabelText("Vista previa")).toBeVisible();
    expect(screen.queryByText("No se pudo armar la imagen. Probá de nuevo.")).toBeNull();
    expect(collage).toHaveBeenCalledTimes(2);
  });

  it("a cancelled share shows no error; another failure shows it", async () => {
    await open("collage");
    await screen.findByRole("button", { name: "Compartir en Stories" });

    story.shareMore.mockRejectedValueOnce(new Error("User did not share"));
    await fireEvent.press(screen.getByRole("button", { name: "Más opciones" }));
    await waitFor(() => expect(story.shareMore).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();

    story.shareToInstagramStories.mockRejectedValueOnce(new Error("boom"));
    await fireEvent.press(screen.getByRole("button", { name: "Compartir en Stories" }));
    expect(await screen.findByText("No se pudo compartir. Probá de nuevo.")).toBeVisible();
  });
});
