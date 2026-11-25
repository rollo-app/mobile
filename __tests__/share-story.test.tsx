import * as Clipboard from "expo-clipboard";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import "@/test/reanimated";
import * as composeStillModule from "@/features/share/compose-still";
import * as renderCollageModule from "@/features/share/render-collage";
import * as renderInviteModule from "@/features/share/render-invite";
import * as shareStory from "@/features/share/share-story";
import * as tripActions from "@/features/trips/actions";
import { keepOriginals } from "@/test/trip";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/share/render-collage", () => ({ renderCollageCard: jest.fn() }));
jest.mock("@/features/share/render-invite", () => ({ renderInviteCard: jest.fn() }));
jest.mock("@/features/share/compose-still", () => ({ composeStill: jest.fn() }));
jest.mock("@/features/share/share-story", () => ({
  ...jest.requireActual("@/features/share/share-story"),
  writeShareFile: jest.fn(),
  instagramStoriesAvailable: jest.fn(),
  shareToInstagramStories: jest.fn(),
  shareMore: jest.fn(),
}));
jest.mock("@/features/share/asset-uri", () => ({ assetUri: jest.fn(async (m: unknown) => `file:///assets/${(m as { testUri: string }).testUri.split("/").pop()}`) }));
const trips = jest.mocked(tripActions);
const collage = jest.mocked(renderCollageModule.renderCollageCard);
const invite = jest.mocked(renderInviteModule.renderInviteCard);
const still = jest.mocked(composeStillModule.composeStill);
const story = jest.mocked(shareStory);
const clipboard = jest.mocked(Clipboard);

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";
const CARD_FILE = (kind: "collage" | "invite", style = "dark") => expect.stringMatching(new RegExp(`^file:///cache/rollo-${kind}-${style}-.*-card\\.png$`));
const STILL_FILE = (kind: "collage" | "invite", style = "dark") => expect.stringMatching(new RegExp(`^file:///cache/rollo-${kind}-${style}-.*-still\\.jpg$`));
const STORIES = { stickerUri: CARD_FILE("collage"), backgroundVideoUri: "file:///assets/bg-dark.mp4", backgroundColor: "#0b0b0c" };

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
  collage.mockResolvedValue({ png: new Uint8Array([1]), width: 920, height: 1100 });
  invite.mockResolvedValue({ png: new Uint8Array([2]), width: 920, height: 1300 });
  still.mockResolvedValue(new Uint8Array([3]));
  // A distinct uri per file, so sharing the card where the still belongs (or the reverse) fails a test.
  story.writeShareFile.mockImplementation(async (_bytes, name) => `file:///cache/${name}`);
  story.instagramStoriesAvailable.mockResolvedValue(true);
  story.shareToInstagramStories.mockResolvedValue(undefined);
  story.shareMore.mockResolvedValue(undefined);
});

/** The files exist: the card is on the preview (the buttons are disabled until then). */
const filesReady = () => screen.findByLabelText("Vista previa");

const lastStyle = (mock: jest.Mock) => mock.mock.calls.at(-1)![0].style;

describe("Compartir screen", () => {
  it("collage: shows the preview, Compartir en Instagram and Otras; Otras rebuilds with a new seed", async () => {
    await open("collage");
    expect(await screen.findByLabelText("Vista previa")).toBeVisible();
    expect(await screen.findByRole("button", { name: "Compartir en Instagram" })).toBeVisible();
    expect(screen.getByTestId("instagram-logo")).toBeVisible();
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
    expect(screen.queryByRole("button", { name: "Compartir en Instagram" })).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Más opciones" }));
    await waitFor(() => expect(story.shareMore).toHaveBeenCalledWith(STILL_FILE("collage"), undefined));
  });

  it("collage: Stories is shared without a link", async () => {
    await open("collage");
    await filesReady();
    await fireEvent.press(await screen.findByRole("button", { name: "Compartir en Instagram" }));
    await waitFor(() => expect(story.shareToInstagramStories).toHaveBeenCalledWith(STORIES));
    expect(clipboard.setStringAsync).not.toHaveBeenCalled();
  });

  it("collage with no shareable photo shows the empty note", async () => {
    await open("collage", detail(), [item("a", { shareable: false })]);
    expect(await screen.findByText("Todavía no hay fotos para armar el collage.")).toBeVisible();
    expect(screen.queryByLabelText("Vista previa")).toBeNull();
    expect(collage).not.toHaveBeenCalled();
  });

  it("collage whose feed failed shows the error with Reintentar, not the empty note", async () => {
    trips.fetchTrip.mockResolvedValue(detail());
    trips.fetchFeedPage.mockRejectedValue(new Error("offline"));
    await renderRouter(routes, { initialUrl: `/share-story?tripId=${SUR}&kind=collage` });
    expect(await screen.findByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(screen.queryByText("Todavía no hay fotos para armar el collage.")).toBeNull();
  });

  it("collage with a single shareable photo has no Otras", async () => {
    await open("collage", detail(), [item("a"), item("b", { shareable: false })]);
    expect(await screen.findByLabelText("Vista previa")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Otras" })).toBeNull();
  });

  it("invite: Stories carries the link, Más opciones copies it, and the sticker note shows", async () => {
    const order: string[] = [];
    clipboard.setStringAsync.mockImplementation(async () => (order.push("copy"), true));
    story.shareToInstagramStories.mockImplementation(async () => void order.push("stories"));
    await open("invite", detail(), [item("a", { shareable: false })]);
    expect(await screen.findByLabelText("Vista previa")).toBeVisible();
    expect(screen.getByText("Copiamos el link. Pegalo en tu story con el sticker de Enlace")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Otras" })).toBeNull();
    expect(invite).toHaveBeenCalledWith(expect.objectContaining({ name: "Viaje al sur", code: "HUB5FT", coverUrl: null }));
    expect(invite.mock.calls[0]![0].swatches.length).toBeGreaterThan(0);

    await filesReady();
    await fireEvent.press(await screen.findByRole("button", { name: "Compartir en Instagram" }));
    await waitFor(() => expect(story.shareToInstagramStories).toHaveBeenCalledWith({ ...STORIES, stickerUri: CARD_FILE("invite"), linkText: expect.stringContaining("HUB5FT") }));
    // The Stories pasteboard write replaces the clipboard: the link travels in the Stories call, not through expo-clipboard.
    expect(clipboard.setStringAsync).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Más opciones" }));
    await waitFor(() => expect(story.shareMore).toHaveBeenCalledWith(STILL_FILE("invite"), expect.stringContaining("HUB5FT")));
    expect(clipboard.setStringAsync).toHaveBeenCalledTimes(1);
    expect(clipboard.setStringAsync).toHaveBeenCalledWith(expect.stringContaining("HUB5FT"));
    expect(order).toEqual(["stories", "copy"]);
  });

  it("defaults to Oscuro and switching to Claro rebuilds with the light style", async () => {
    await open("collage");
    expect(await screen.findByLabelText("Vista previa")).toBeVisible();
    expect(collage.mock.calls[0]![0].style).toBe("dark");
    expect(still.mock.calls[0]![1]).toBe("dark");

    await fireEvent.press(screen.getByRole("button", { name: "Claro" }));
    await waitFor(() => expect(collage).toHaveBeenCalledTimes(2));
    expect(lastStyle(collage as unknown as jest.Mock)).toBe("light");
    expect(still.mock.calls.at(-1)![1]).toBe("light");
  });

  it("Stories shares the card as sticker over the style's video", async () => {
    await open("collage");
    await fireEvent.press(await screen.findByRole("button", { name: "Claro" }));
    await waitFor(() => expect(collage).toHaveBeenCalledTimes(2));
    await filesReady();
    await fireEvent.press(await screen.findByRole("button", { name: "Compartir en Instagram" }));
    await waitFor(() => expect(story.shareToInstagramStories).toHaveBeenCalledTimes(1));
    const call = story.shareToInstagramStories.mock.calls[0]![0];
    expect(call.stickerUri).toEqual(CARD_FILE("collage", "light"));
    expect(call.backgroundColor).toBe("#f3efe8");
    expect(call.backgroundVideoUri).toBe("file:///assets/bg-light.mp4");
  });

  it("Más opciones shares the composed still of the chosen style", async () => {
    await open("collage");
    await fireEvent.press(await screen.findByRole("button", { name: "Claro" }));
    await waitFor(() => expect(still).toHaveBeenCalledWith(expect.anything(), "light"));
    await filesReady();
    await fireEvent.press(await screen.findByRole("button", { name: "Más opciones" }));
    await waitFor(() => expect(story.shareMore).toHaveBeenCalledWith(STILL_FILE("collage", "light"), undefined));
  });

  it("switching style twice shares the last one", async () => {
    await open("collage");
    await fireEvent.press(await screen.findByRole("button", { name: "Claro" }));
    await fireEvent.press(screen.getByRole("button", { name: "Oscuro" }));
    await fireEvent.press(screen.getByRole("button", { name: "Claro" }));
    await waitFor(() => expect(lastStyle(collage as unknown as jest.Mock)).toBe("light"));
    await filesReady();
    await fireEvent.press(await screen.findByRole("button", { name: "Compartir en Instagram" }));
    await waitFor(() => expect(story.shareToInstagramStories).toHaveBeenCalledWith(expect.objectContaining({ backgroundColor: "#f3efe8", backgroundVideoUri: "file:///assets/bg-light.mp4" })));
  });

  it("going back to Oscuro after Claro shares the dark files, not the light ones", async () => {
    await open("collage");
    await filesReady();
    await fireEvent.press(screen.getByRole("button", { name: "Claro" }));
    await waitFor(() => expect(collage).toHaveBeenCalledTimes(2));
    await fireEvent.press(screen.getByRole("button", { name: "Oscuro" }));
    // Cached: no third render.
    await waitFor(() => expect(screen.getByTestId("story-preview")).toHaveStyle({ backgroundColor: "#0b0b0c" }));
    await filesReady();
    expect(collage).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Vista previa").props.source).toEqual([expect.objectContaining({ uri: CARD_FILE("collage") })]);

    await fireEvent.press(await screen.findByRole("button", { name: "Compartir en Instagram" }));
    await waitFor(() => expect(story.shareToInstagramStories).toHaveBeenCalledWith(expect.objectContaining({ stickerUri: CARD_FILE("collage") })));
    await fireEvent.press(screen.getByRole("button", { name: "Más opciones" }));
    await waitFor(() => expect(story.shareMore).toHaveBeenCalledWith(STILL_FILE("collage"), undefined));
  });

  it("without Instagram only Más opciones, with the chosen style's still", async () => {
    story.instagramStoriesAvailable.mockResolvedValue(false);
    await open("invite");
    await fireEvent.press(await screen.findByRole("button", { name: "Claro" }));
    await waitFor(() => expect(still).toHaveBeenCalledWith(expect.anything(), "light"));
    expect(screen.queryByRole("button", { name: "Compartir en Instagram" })).toBeNull();
    await filesReady();
    await fireEvent.press(await screen.findByRole("button", { name: "Más opciones" }));
    await waitFor(() => expect(story.shareMore).toHaveBeenCalledWith(STILL_FILE("invite", "light"), expect.stringContaining("HUB5FT")));
    expect(lastStyle(invite as unknown as jest.Mock)).toBe("light");
  });

  it("the preview shows the card over the base color even if the video never plays", async () => {
    await open("collage");
    const card = await screen.findByLabelText("Vista previa");
    expect(card).toBeVisible();
    expect([card.props.source].flat()[0].uri).toEqual(CARD_FILE("collage"));
    expect(screen.getByTestId("story-preview")).toHaveStyle({ backgroundColor: "#0b0b0c" });
    await fireEvent.press(screen.getByRole("button", { name: "Claro" }));
    await waitFor(() => expect(screen.getByTestId("story-preview")).toHaveStyle({ backgroundColor: "#f3efe8" }));
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
    await filesReady();

    story.shareMore.mockRejectedValueOnce(new Error("User did not share"));
    await fireEvent.press(screen.getByRole("button", { name: "Más opciones" }));
    await waitFor(() => expect(story.shareMore).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();

    story.shareToInstagramStories.mockRejectedValueOnce(new Error("boom"));
    await fireEvent.press(screen.getByRole("button", { name: "Compartir en Instagram" }));
    expect(await screen.findByText("No se pudo compartir. Probá de nuevo.")).toBeVisible();
  });
});
