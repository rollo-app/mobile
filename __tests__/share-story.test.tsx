import * as Burnt from "burnt";
import * as Clipboard from "expo-clipboard";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Text } from "react-native";
import { setCollageSelection } from "@/features/share/collage-selection";
import * as filmExport from "@/features/share/film-export";
import { setFilmSelection } from "@/features/share/film-selection";
import { PermissionDeniedError } from "@/features/gallery/save";
import * as shareVideo from "@/features/share/share-video";
import * as filmHook from "@/features/journey/use-film";
import { usePoster } from "@/features/journey/poster/use-poster";
import Share from "react-native-share";
import * as sheetHook from "@/features/journey/use-sheet-film";
import { setSheetChoices } from "@/features/share/sheet-selection";
import { cancelVideo } from "../modules/rollo-video";
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
  whatsAppAvailable: jest.fn(),
  shareImageToWhatsApp: jest.fn(),
  shareTextToWhatsApp: jest.fn(),
  shareToInstagramStories: jest.fn(),
  shareMore: jest.fn(),
}));
jest.mock("@/features/share/asset-uri", () => ({ assetUri: jest.fn(async (m: unknown) => `file:///assets/${(m as { testUri: string }).testUri.split("/").pop()}`) }));
let mockVideoAvailable = true;
jest.mock("../modules/rollo-video", () => ({
  get videoAvailable() {
    return mockVideoAvailable;
  },
  cancelVideo: jest.fn(),
  shareVideoToInstagram: jest.fn(),
}));
jest.mock("@/features/share/share-video", () => ({
  saveVideo: jest.fn(),
  shareVideoMore: jest.fn(),
  shareVideoToInstagramApp: jest.fn(),
  instagramRoute: jest.requireActual("@/features/share/share-video").instagramRoute,
}));
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
      coverFocusY: null,
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

async function open(kind: "collage" | "invite" | "journey" | "sheet", d = detail(), items = [item("a"), item("b")]) {
  trips.fetchTrip.mockResolvedValue(d);
  trips.fetchFeedPage.mockResolvedValue(feed(items, d.trip.revealed));
  await renderRouter({ ...routes, "share-pick": () => <Text>pick stub</Text> }, { initialUrl: `/share-story?tripId=${SUR}&kind=${kind}` });
}


beforeEach(async () => {
  jest.clearAllMocks();
  mockVideoAvailable = true;
  setFilmSelection(SUR, []);
  setSheetChoices(SUR, {});
  setCollageSelection(SUR, []);
  for (const mock of Object.values(trips)) (mock as Partial<jest.Mock>).mockReset?.();
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
  collage.mockResolvedValue({ png: new Uint8Array([1]), width: 920, height: 1100 });
  invite.mockResolvedValue({ png: new Uint8Array([2]), width: 920, height: 1300 });
  still.mockResolvedValue(new Uint8Array([3]));
  // A distinct uri per file, so sharing the card where the still belongs (or the reverse) fails a test.
  story.writeShareFile.mockImplementation(async (_bytes, name) => `file:///cache/${name}`);
  story.instagramStoriesAvailable.mockResolvedValue(true);
  story.whatsAppAvailable.mockResolvedValue(false);
  story.shareImageToWhatsApp.mockResolvedValue(undefined);
  story.shareTextToWhatsApp.mockResolvedValue(undefined);
  story.shareToInstagramStories.mockResolvedValue(undefined);
  story.shareMore.mockResolvedValue(undefined);
});

/** The files exist: the card is on the preview (the buttons are disabled until then). */
const filesReady = () => screen.findByLabelText("Vista previa");

const lastStyle = (mock: jest.Mock) => mock.mock.calls.at(-1)![0].style;

describe("Compartir screen", () => {
  it("collage: shows the preview, Instagram and Elegir fotos; Elegir fotos opens the picker", async () => {
    await open("collage");
    expect(await screen.findByLabelText("Vista previa")).toBeVisible();
    expect(await screen.findByRole("button", { name: "Instagram" })).toBeVisible();
    expect(screen.getByTestId("instagram-logo")).toBeVisible();
    expect(screen.getByRole("button", { name: "Más opciones" })).toBeVisible();
    expect(collage).toHaveBeenCalledTimes(1);
    expect(collage.mock.calls[0]![0]).toMatchObject({ name: "Viaje al sur", caption: "3 – 9 de enero · 1 persona" });
    expect(screen.queryByRole("button", { name: "Otras" })).toBeNull();

    await fireEvent.press(screen.getByLabelText("Elegir fotos"));
    expect(await screen.findByText("pick stub")).toBeVisible();
    expect(screen).toHavePathname("/share-pick");
    expect(screen).toHaveSearchParams({ tripId: SUR, seed: "1" });
  });

  it("collage uses the selected photos in order, and a new selection rebuilds the image", async () => {
    setCollageSelection(SUR, ["c", "a"]);
    await open("collage", detail(), [item("a"), item("b"), item("c")]);
    expect(await screen.findByLabelText("Vista previa")).toBeVisible();
    expect(collage.mock.calls[0]![0].photos.map((p) => p.id)).toEqual(["c", "a"]);

    await act(async () => setCollageSelection(SUR, ["b"]));
    await waitFor(() => expect(collage).toHaveBeenCalledTimes(2));
    expect(collage.mock.calls[1]![0].photos.map((p) => p.id)).toEqual(["b"]);
  });

  it("collage: the strip shows the numbered photos in collage order, with a plus", async () => {
    setCollageSelection(SUR, ["c", "a"]);
    await open("collage", detail(), [item("a"), item("b"), item("c")]);
    await filesReady();
    expect(screen.getByTestId("strip-badge-c")).toHaveTextContent("1");
    expect(screen.getByTestId("strip-badge-a")).toHaveTextContent("2");
    expect(screen.queryByTestId("strip-badge-b")).toBeNull();
    expect(screen.getByTestId("strip-add")).toBeVisible();
    expect(screen.getByLabelText("Elegir fotos")).toHaveProp("accessibilityHint", "El collage tiene 2 fotos");
    expect(screen.queryByRole("button", { name: "Elegir fotos" })).not.toBeNull();
  });

  it("collage: with 7 photos the strip shows 4 numbered thumbnails and a +3 tile", async () => {
    setCollageSelection(SUR, ["a", "b", "c", "d", "e", "f", "g"]);
    await open("collage", detail(), ["a", "b", "c", "d", "e", "f", "g"].map((id) => item(id)));
    await filesReady();
    for (const [i, id] of ["a", "b", "c", "d"].entries()) expect(screen.getByTestId(`strip-badge-${id}`)).toHaveTextContent(String(i + 1));
    for (const id of ["e", "f", "g"]) expect(screen.queryByTestId(`strip-badge-${id}`)).toBeNull();
    expect(screen.getByTestId("strip-more")).toHaveTextContent("+3");
    expect(screen.getByLabelText("Elegir fotos")).toHaveProp("accessibilityHint", "El collage tiene 7 fotos");
  });

  it("collage: with 3 photos the strip shows 3 thumbnails and the plus tile", async () => {
    setCollageSelection(SUR, ["a", "b", "c"]);
    await open("collage", detail(), ["a", "b", "c"].map((id) => item(id)));
    await filesReady();
    for (const id of ["a", "b", "c"]) expect(screen.getByTestId(`strip-badge-${id}`)).toBeVisible();
    expect(screen.getByTestId("strip-add")).toBeVisible();
    expect(screen.queryByTestId("strip-more")).toBeNull();
  });

  it("collage: with a single candidate the strip has no plus and is not tappable", async () => {
    await open("collage", detail(), [item("a")]);
    await filesReady();
    expect(screen.getByTestId("strip-badge-a")).toHaveTextContent("1");
    expect(screen.queryByTestId("strip-add")).toBeNull();
    expect(screen.queryByLabelText("Elegir fotos")).toBeNull();
  });

  it("invite: no photo strip", async () => {
    await open("invite", detail(), [item("a"), item("b")]);
    await filesReady();
    expect(screen.queryByLabelText("Elegir fotos")).toBeNull();
    expect(screen.queryByTestId("strip-badge-a")).toBeNull();
  });

  it("chips reflect the selected style", async () => {
    await open("collage");
    await filesReady();
    expect(screen.getByRole("button", { name: "Oscuro" })).toHaveProp("accessibilityState", { selected: true });
    await fireEvent.press(screen.getByRole("button", { name: "Claro" }));
    expect(screen.getByRole("button", { name: "Claro" })).toHaveProp("accessibilityState", { selected: true });
    expect(screen.getByRole("button", { name: "Oscuro" })).toHaveProp("accessibilityState", { selected: false });
  });

  it("WhatsApp pill shows only when WhatsApp is available", async () => {
    await open("collage");
    await filesReady();
    expect(screen.queryByRole("button", { name: "WhatsApp" })).toBeNull();
  });

  it("WhatsApp pill shares the still of the selected style", async () => {
    story.whatsAppAvailable.mockResolvedValue(true);
    await open("collage");
    await fireEvent.press(await screen.findByRole("button", { name: "Claro" }));
    await waitFor(() => expect(still).toHaveBeenCalledWith(expect.anything(), "light"));
    await filesReady();
    await fireEvent.press(await screen.findByRole("button", { name: "WhatsApp" }));
    await waitFor(() => expect(story.shareImageToWhatsApp).toHaveBeenCalledWith(STILL_FILE("collage", "light")));
  });

  it("invite: WhatsApp sends only the invitation text with the join link (WhatsApp draws the link's preview)", async () => {
    story.whatsAppAvailable.mockResolvedValue(true);
    await open("invite", detail(), [item("a", { shareable: false })]);
    await filesReady();
    await fireEvent.press(await screen.findByRole("button", { name: "WhatsApp" }));
    await waitFor(() => expect(story.shareTextToWhatsApp).toHaveBeenCalledTimes(1));
    const text = story.shareTextToWhatsApp.mock.calls[0]![0];
    expect(text).toMatch(/^Sumate a \*[^*]+\* en Rollo: https:\/\/rolloproject\.com\/join\/HUB5FT$/);
    expect(story.shareImageToWhatsApp).not.toHaveBeenCalled();
    expect(clipboard.setStringAsync).not.toHaveBeenCalled();
  });

  it("invite of a full rollo (opened from the list) says so and offers nothing", async () => {
    await open("invite", detail({ maxMembers: 1 }));
    expect(await screen.findByText("Este rollo está lleno: no se puede invitar a más gente.")).toBeVisible();
    expect(screen.queryByLabelText("Vista previa")).toBeNull();
    expect(screen.queryByRole("button", { name: "Más opciones" })).toBeNull();
    expect(invite).not.toHaveBeenCalled();
  });

  it("collage of a private rollo (opened from the list) says so and offers nothing", async () => {
    await open("collage", detail({ revealed: true, featuringDisabled: true }));
    expect(await screen.findByText("Este rollo es privado: sus fotos no se comparten fuera del rollo.")).toBeVisible();
    expect(screen.queryByLabelText("Vista previa")).toBeNull();
    expect(collage).not.toHaveBeenCalled();
  });

  it("collage without Instagram: only Más opciones", async () => {
    story.instagramStoriesAvailable.mockResolvedValue(false);
    await open("collage");
    expect(await screen.findByLabelText("Vista previa")).toBeVisible();
    expect(screen.getByRole("button", { name: "Más opciones" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Instagram" })).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Más opciones" }));
    await waitFor(() => expect(story.shareMore).toHaveBeenCalledWith(STILL_FILE("collage"), undefined));
  });

  it("collage: Stories is shared without a link", async () => {
    await open("collage");
    await filesReady();
    await fireEvent.press(await screen.findByRole("button", { name: "Instagram" }));
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
    await fireEvent.press(await screen.findByRole("button", { name: "Instagram" }));
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
    await fireEvent.press(await screen.findByRole("button", { name: "Instagram" }));
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
    await fireEvent.press(await screen.findByRole("button", { name: "Instagram" }));
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

    await fireEvent.press(await screen.findByRole("button", { name: "Instagram" }));
    await waitFor(() => expect(story.shareToInstagramStories).toHaveBeenCalledWith(expect.objectContaining({ stickerUri: CARD_FILE("collage") })));
    await fireEvent.press(screen.getByRole("button", { name: "Más opciones" }));
    await waitFor(() => expect(story.shareMore).toHaveBeenCalledWith(STILL_FILE("collage"), undefined));
  });

  it("without Instagram only Más opciones, with the chosen style's still", async () => {
    story.instagramStoriesAvailable.mockResolvedValue(false);
    await open("invite");
    await fireEvent.press(await screen.findByRole("button", { name: "Claro" }));
    await waitFor(() => expect(still).toHaveBeenCalledWith(expect.anything(), "light"));
    expect(screen.queryByRole("button", { name: "Instagram" })).toBeNull();
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

  it("a build failure warns once, naming the step that failed", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    still.mockRejectedValueOnce(new Error("jpeg"));
    await open("collage");
    expect(await screen.findByText("No se pudo armar la imagen. Probá de nuevo.")).toBeVisible();
    const shareWarnings = warn.mock.calls.filter(([message]) => String(message).startsWith("[share]"));
    expect(shareWarnings).toEqual([["[share] could not build the image", expect.objectContaining({ message: "compose still failed" })]]);
    warn.mockRestore();
  });

  it("a cancelled share shows no error; another failure shows it", async () => {
    await open("collage");
    await filesReady();

    story.shareMore.mockRejectedValueOnce(new Error("User did not share"));
    await fireEvent.press(screen.getByRole("button", { name: "Más opciones" }));
    await waitFor(() => expect(story.shareMore).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();

    story.shareToInstagramStories.mockRejectedValueOnce(new Error("boom"));
    await fireEvent.press(screen.getByRole("button", { name: "Instagram" }));
    expect(await screen.findByText("No se pudo compartir. Probá de nuevo.")).toBeVisible();
  });

  it("Copiar link shows only on the invite", async () => {
    await open("collage");
    await filesReady();
    expect(screen.queryByRole("button", { name: "Copiar link" })).toBeNull();
  });

  it("invite: Copiar link copies the link and shows the HUD", async () => {
    await open("invite", detail());
    await filesReady();
    await fireEvent.press(screen.getByRole("button", { name: "Copiar link" }));
    await waitFor(() => expect(clipboard.setStringAsync).toHaveBeenCalledWith(expect.stringContaining("HUB5FT")));
    expect(Burnt.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Link copiado" }));
    expect(story.shareMore).not.toHaveBeenCalled();
    expect(screen.getByText("Copiamos el link. Pegalo en tu story con el sticker de Enlace")).toBeVisible();
  });

  it("invite: a clipboard failure on Copiar link shows the error and no HUD", async () => {
    clipboard.setStringAsync.mockRejectedValueOnce(new Error("boom"));
    await open("invite", detail());
    await filesReady();
    await fireEvent.press(screen.getByRole("button", { name: "Copiar link" }));
    expect(await screen.findByText("No se pudo compartir. Probá de nuevo.")).toBeVisible();
    expect(Burnt.toast).not.toHaveBeenCalled();
  });

  it("invite: Copiar link works while the image is still building", async () => {
    invite.mockReturnValue(new Promise(() => {}));
    await open("invite", detail());
    const copy = await screen.findByRole("button", { name: "Copiar link" });
    expect(screen.getByRole("button", { name: "Más opciones" })).toHaveProp("accessibilityState", { disabled: true });
    await fireEvent.press(copy);
    await waitFor(() => expect(clipboard.setStringAsync).toHaveBeenCalledWith(expect.stringContaining("HUB5FT")));
    expect(Burnt.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Link copiado" }));
  });
});

describe("Compartir: Recorrido", () => {
  const useFilm = jest.mocked(filmHook.useFilm);
  const exportFile = jest.mocked(filmExport.exportFilmToFile);
  const video = jest.mocked(shareVideo);
  const FILE = { uri: "file:///cache/rollo-recorrido.mp4", bytes: 1000, frames: 30 };
  const readyFilm = (version = "v1", durationMs = 30_000) =>
    ({ status: "ready", film: { kind: "route", scene: {}, assets: {}, durationMs, restAt: 0, version }, stops: [], photos: [] }) as unknown as filmHook.Film;

  // Two places far apart, so the share cut gives two stops.
  const at = (id: string, lat: number, lng: number) => item(id, { lat, lng });
  const TWO_PLACES = [at("a", -41.13, -71.31), at("b", -41.14, -71.32), at("c", -42.9, -71.3), at("d", -42.91, -71.31)];
  const revealed = (over: Partial<tripActions.Trip> = {}) => detail({ revealed: true, ...over });

  async function openFilm(d = revealed(), items = TWO_PLACES, kind: "collage" | "journey" = "collage") {
    await open(kind, d, items);
    await screen.findByRole("button", { name: kind === "collage" ? "Instagram" : "Más opciones" });
  }
  async function toRecorrido() {
    await fireEvent.press(await screen.findByRole("button", { name: "Recorrido" }));
  }

  beforeEach(() => {
    useFilm.mockReset();
    useFilm.mockReturnValue(readyFilm());
    exportFile.mockReset();
    exportFile.mockResolvedValue(FILE);
    video.saveVideo.mockResolvedValue(undefined);
    video.shareVideoMore.mockResolvedValue(undefined);
    video.shareVideoToInstagramApp.mockResolvedValue("stories");
  });

  it("shows Collage | Recorrido on a revealed roll with a route, opening on Collage with no film loaded", async () => {
    await openFilm();
    expect(screen.getByRole("button", { name: "Collage" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Recorrido" })).toBeVisible();
    expect(screen.queryByTestId("film-player")).toBeNull();
    for (const call of useFilm.mock.calls) expect(call[0].enabled).toBe(false);
  });

  it.each([
    ["an event", () => revealed({ type: "event" }), TWO_PLACES, () => filesReady()],
    ["a private roll", () => revealed({ featuringDisabled: true }), TWO_PLACES, () => screen.findByText(/es privado/)],
    ["a roll with a single place", () => revealed(), [at("a", -41.13, -71.31), at("b", -41.14, -71.32)], () => filesReady()],
  ])("%s shows no control", async (_name, make, items, settled) => {
    await open("collage", make(), items as tripActions.Feed["items"]);
    // The screen has decided what to show (the collage, or the private note) before we look for the control.
    await settled();
    expect(screen.queryByRole("button", { name: "Recorrido" })).toBeNull();
  });

  it("shows no control when the build has no video module", async () => {
    mockVideoAvailable = false;
    await open("collage", revealed(), TWO_PLACES);
    await filesReady();
    expect(screen.queryByRole("button", { name: "Recorrido" })).toBeNull();
  });

  it("kind=journey opens on Recorrido", async () => {
    await openFilm(revealed(), TWO_PLACES, "journey");
    expect(screen.getByTestId("film-player")).toBeVisible();
  });

  describe("Afiche", () => {
    const posterReady = { status: "ready", uri: "file:///cache/afiche.jpg", version: "v1" } as const;
    const toAfiche = async () => fireEvent.press(await screen.findByRole("button", { name: "Afiche" }));

    beforeEach(() => {
      jest.mocked(usePoster).mockReset();
      jest.mocked(usePoster).mockReturnValue({ status: "loading" });
      story.instagramStoriesAvailable.mockResolvedValue(true);
    });

    it("offers Afiche before Recorrido on a roll with a route", async () => {
      await openFilm();
      const labels = ["Collage", "Afiche", "Recorrido"].map((name) => screen.getByRole("button", { name }));
      expect(labels).toHaveLength(3);
      expect(screen.getByRole("button", { name: "Afiche" })).toBeVisible();
      // Relative order in the control: the two images first (Collage, Afiche), then the videos.
      const names = screen.getAllByRole("button").map((b) => b.props.accessibilityLabel).filter((n) => ["Collage", "Recorrido", "Afiche"].includes(n));
      expect(names).toEqual(["Collage", "Afiche", "Recorrido"]);
    });

    it("does not offer Afiche without a route", async () => {
      await open("collage", revealed(), [at("a", -41.13, -71.31), at("b", -41.14, -71.32)]);
      await filesReady();
      expect(screen.queryByRole("button", { name: "Afiche" })).toBeNull();
    });

    it("shows the poster and shares it to Instagram", async () => {
      jest.mocked(usePoster).mockReturnValue(posterReady);
      await openFilm();
      await toAfiche();
      expect(await screen.findByLabelText("Vista previa del afiche")).toBeVisible();
      await fireEvent.press(screen.getByRole("button", { name: "Instagram" }));
      await waitFor(() => expect(Share.shareSingle).toHaveBeenCalledWith(expect.objectContaining({ backgroundImage: "file:///cache/afiche.jpg" })));
      await fireEvent.press(screen.getByRole("button", { name: "Más opciones" }));
      await waitFor(() => expect(story.shareMore).toHaveBeenCalledWith("file:///cache/afiche.jpg"));
    });

    it("says there is no route when the chosen photos leave one place", async () => {
      jest.mocked(usePoster).mockReturnValue({ status: "no-route" });
      await openFilm();
      await toAfiche();
      expect(await screen.findByText("Con estas fotos no hay recorrido: elegí fotos de al menos dos lugares.")).toBeVisible();
      expect(screen.queryByRole("button", { name: "Instagram" })).toBeNull();
    });

    it("offers a retry when the poster cannot be built", async () => {
      const retry = jest.fn();
      jest.mocked(usePoster).mockReturnValue({ status: "error", offline: true, retry });
      await openFilm();
      await toAfiche();
      expect(await screen.findByText("Para armar el afiche hace falta conexión.")).toBeVisible();
      await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
      expect(retry).toHaveBeenCalled();
    });
  });

  it("Recorrido: shows the player and the three pills, with no Otra versión and one stable random seed", async () => {
    await openFilm();
    await toRecorrido();
    expect(await screen.findByTestId("film-player")).toHaveProp("accessibilityLabel", "playing");
    expect(screen.getByRole("button", { name: "Instagram" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Guardar video" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Más opciones" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Oscuro" })).toBeNull();
    expect(screen.queryByRole("button", { name: "WhatsApp" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Otra versión" })).toBeNull();
    const seed = useFilm.mock.calls.at(-1)![0].seed;
    expect(Number.isInteger(seed) && seed > 0).toBe(true);
    // Re-rendering the same mount (a new selection) keeps the seed.
    await act(async () => setFilmSelection(SUR, ["a", "c"]));
    const seeds = useFilm.mock.calls.filter((c) => c[0].enabled).map((c) => c[0].seed);
    expect(new Set(seeds)).toEqual(new Set([seed]));
    expect(useFilm.mock.calls.at(-1)![0].enabled).toBe(true);
  });

  it("Recorrido: the strip's plus opens the film picker", async () => {
    await openFilm();
    await toRecorrido();
    await fireEvent.press(await screen.findByRole("button", { name: "Elegir fotos" }));
    expect(screen).toHavePathname("/share-pick");
    expect(screen).toHaveSearchParams({ tripId: SUR, kind: "journey" });
  });

  it("Guardar video exports once with the player paused, saves, and Más opciones reuses the file", async () => {
    let finish!: (file: typeof FILE) => void;
    exportFile.mockImplementationOnce(
      (_film, _input, options) =>
        new Promise((resolve) => {
          options.onProgress(21, 50);
          finish = resolve;
        }),
    );
    await openFilm();
    await toRecorrido();
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar video" }));
    expect(await screen.findByText("Armando el video… 42 %")).toBeVisible();
    expect(screen.getByTestId("film-cancel")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Guardar video" })).toBeNull();
    expect(screen.getByTestId("film-player")).toHaveProp("accessibilityLabel", "paused");
    await act(async () => finish(FILE));
    await waitFor(() => expect(video.saveVideo).toHaveBeenCalledWith(FILE.uri));
    expect(Burnt.toast).toHaveBeenCalledWith({ title: "Guardado en Fotos", preset: "done" });
    expect(exportFile).toHaveBeenCalledTimes(1);
    expect(exportFile.mock.calls[0]![1]).toEqual({ tripId: SUR });

    await fireEvent.press(await screen.findByRole("button", { name: "Más opciones" }));
    await waitFor(() => expect(video.shareVideoMore).toHaveBeenCalledWith(FILE.uri));
    expect(exportFile).toHaveBeenCalledTimes(1);
  });

  it("Instagram by the library route leaves the note until the version changes", async () => {
    video.shareVideoToInstagramApp.mockResolvedValue("library");
    await openFilm();
    await toRecorrido();
    await fireEvent.press(await screen.findByRole("button", { name: "Instagram" }));
    expect(await screen.findByText("Lo guardamos en tus fotos. Elegilo en tu historia.")).toBeVisible();
    expect(video.shareVideoToInstagramApp).toHaveBeenCalledWith(FILE.uri, 30_000);
    useFilm.mockReturnValue(readyFilm("v2"));
    await act(async () => setFilmSelection(SUR, ["a", "c"]));
    expect(screen.queryByText("Lo guardamos en tus fotos. Elegilo en tu historia.")).toBeNull();
  });

  /** An export that waits, and ends the way the real one does when cancelled. */
  function hangingExport() {
    let options!: Parameters<typeof filmExport.exportFilmToFile>[2];
    exportFile.mockImplementationOnce(
      (_film, _input, o) =>
        new Promise((resolve) => {
          options = o;
          const timer = setInterval(() => {
            if (o.isCancelled()) {
              clearInterval(timer);
              cancelVideo();
              resolve(null);
            }
          }, 5);
        }),
    );
    return () => options;
  }

  it("Cancelar during the export cancels the video and brings the pills back", async () => {
    hangingExport();
    await openFilm();
    await toRecorrido();
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar video" }));
    await waitFor(() => expect(exportFile).toHaveBeenCalledTimes(1));
    await fireEvent.press(await screen.findByTestId("film-cancel"));
    expect(await screen.findByRole("button", { name: "Guardar video" })).toBeVisible();
    await waitFor(() => expect(cancelVideo).toHaveBeenCalled());
    expect(video.saveVideo).not.toHaveBeenCalled();
    expect(screen.getByTestId("film-player")).toHaveProp("accessibilityLabel", "playing");
  });

  it("changing the selection during an export cancels it", async () => {
    const getOptions = hangingExport();
    await openFilm();
    await toRecorrido();
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar video" }));
    await screen.findByText(/Armando el video…/);
    await waitFor(() => expect(exportFile).toHaveBeenCalledTimes(1));
    useFilm.mockReturnValue(readyFilm("v2"));
    await act(async () => setFilmSelection(SUR, ["a", "c"]));
    expect(await screen.findByRole("button", { name: "Guardar video" })).toBeVisible();
    expect(getOptions().isCancelled()).toBe(true);
    await waitFor(() => expect(cancelVideo).toHaveBeenCalled());
  });

  it("an export failure says so with a retry", async () => {
    exportFile.mockRejectedValueOnce(new Error("boom"));
    await openFilm();
    await toRecorrido();
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar video" }));
    expect(await screen.findByText("No se pudo armar el video. Probá de nuevo.")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(video.saveVideo).toHaveBeenCalledWith(FILE.uri));
  });

  it("offline load error shows the connection message and a retry", async () => {
    const retry = jest.fn();
    useFilm.mockReturnValue({ status: "error", offline: true, retry });
    await openFilm();
    await toRecorrido();
    expect(await screen.findByText("Para armar el recorrido hace falta conexión.")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(retry).toHaveBeenCalled();
  });

  it("another load error shows the generic message", async () => {
    useFilm.mockReturnValue({ status: "error", offline: false, retry: jest.fn() });
    await openFilm();
    await toRecorrido();
    expect(await screen.findByText("No se pudo armar el recorrido. Probá de nuevo.")).toBeVisible();
  });

  it("while loading, says it is building the film", async () => {
    useFilm.mockReturnValue({ status: "loading", done: 0, total: 0 });
    await openFilm();
    await toRecorrido();
    expect(await screen.findByText("Armando el recorrido…")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Guardar video" })).toBeNull();
  });

  it("while loading, shows the progress as a percentage", async () => {
    useFilm.mockReturnValue({ status: "loading", done: 2, total: 5 });
    await openFilm();
    await toRecorrido();
    expect(await screen.findByText("Armando el recorrido… 40 %")).toBeVisible();
  });

  it("the player is already paused when the export starts drawing", async () => {
    let labelAtStart: unknown;
    exportFile.mockImplementationOnce(async () => {
      labelAtStart = screen.getByTestId("film-player").props.accessibilityLabel;
      return FILE;
    });
    await openFilm();
    await toRecorrido();
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar video" }));
    await waitFor(() => expect(exportFile).toHaveBeenCalledTimes(1));
    expect(labelAtStart).toBe("paused");
  });

  it("never shares a file of another version: after A, B and back to A it exports again", async () => {
    await openFilm();
    await toRecorrido();
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar video" }));
    await waitFor(() => expect(video.saveVideo).toHaveBeenCalledTimes(1));
    useFilm.mockReturnValue(readyFilm("v2"));
    await act(async () => setFilmSelection(SUR, ["a", "c"]));
    useFilm.mockReturnValue(readyFilm("v1"));
    await act(async () => setFilmSelection(SUR, ["a", "b", "c"]));
    await fireEvent.press(await screen.findByRole("button", { name: "Más opciones" }));
    await waitFor(() => expect(video.shareVideoMore).toHaveBeenCalledTimes(1));
    expect(exportFile).toHaveBeenCalledTimes(2);
  });

  it("a re-tap right after Cancelar waits for the cancelled run to finish", async () => {
    let settle!: () => void;
    exportFile.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = () => resolve(null);
        }),
    );
    await openFilm();
    await toRecorrido();
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar video" }));
    await waitFor(() => expect(exportFile).toHaveBeenCalledTimes(1));
    await fireEvent.press(await screen.findByTestId("film-cancel"));
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar video" }));
    // Give the second run every chance to start: it must still be waiting for the first.
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(exportFile).toHaveBeenCalledTimes(1);
    await act(async () => settle());
    await waitFor(() => expect(exportFile).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(video.saveVideo).toHaveBeenCalledTimes(1));
  });

  it("unmounting the Recorrido during an export cancels it", async () => {
    const getOptions = hangingExport();
    await openFilm();
    await toRecorrido();
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar video" }));
    await screen.findByText(/Armando el video…/);
    await waitFor(() => expect(exportFile).toHaveBeenCalledTimes(1));
    // Back to Collage unmounts the Recorrido body, like leaving the screen does.
    await fireEvent.press(screen.getByRole("button", { name: "Collage" }));
    await waitFor(() => expect(getOptions().isCancelled()).toBe(true));
  });

  it("a denied Photos permission shows the gallery's notice, not the video error", async () => {
    video.saveVideo.mockRejectedValueOnce(new PermissionDeniedError(false));
    await openFilm();
    await toRecorrido();
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar video" }));
    expect(await screen.findByText("Rollo no tiene permiso para guardar en Fotos.")).toBeVisible();
    expect(screen.queryByText("No se pudo armar el video. Probá de nuevo.")).toBeNull();
  });

  it("a roll whose shareable photos have no coordinates shows no control", async () => {
    await open("collage", revealed(), [item("a"), item("b")]);
    await filesReady();
    expect(screen.queryByRole("button", { name: "Recorrido" })).toBeNull();
  });

  it("useFilm only gets shareable geolocated photos, never a non-shareable or archived one", async () => {
    const items = [...TWO_PLACES, at("hidden", -41.13, -71.31), at("gone", -42.9, -71.3)].map((it) =>
      it.id === "hidden" ? { ...it, shareable: false } : it.id === "gone" ? { ...it, archived: true } : it,
    );
    await openFilm(revealed(), items as tripActions.Feed["items"], "journey");
    await waitFor(() => expect(useFilm.mock.calls.some((c) => c[0].enabled && c[0].photos.length > 0)).toBe(true));
    const ids = useFilm.mock.calls.flatMap((c) => c[0].photos.map((p) => p.id));
    expect(new Set(ids)).toEqual(new Set(["a", "b", "c", "d"]));
  });

  it("no-route after a selection shows the line, keeps the strip and offers no pills", async () => {
    await openFilm();
    await toRecorrido();
    await screen.findByRole("button", { name: "Guardar video" });
    useFilm.mockReturnValue({ status: "no-route" });
    await act(async () => setFilmSelection(SUR, ["a", "b"]));
    expect(await screen.findByText("Con estas fotos no hay recorrido: elegí fotos de al menos dos lugares.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Guardar video" })).toBeNull();
    expect(screen.getByRole("button", { name: "Elegir fotos" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Recorrido" })).toBeVisible();
  });
});


describe("Compartir: Resumen", () => {
  const useSheetFilm = jest.mocked(sheetHook.useSheetFilm);
  const exportFile = jest.mocked(filmExport.exportFilmToFile);
  const video = jest.mocked(shareVideo);
  const FILE = { uri: "file:///cache/rollo-video.mp4", bytes: 1000, frames: 30 };
  const readyFilm = (version = "s1") =>
    ({ status: "ready", film: { kind: "sheet", scene: {}, assets: {}, durationMs: 40_000, restAt: 0, version }, photos: [] }) as unknown as sheetHook.SheetFilm;
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${String(i).padStart(2, "0")}`);
  // Spread in time, no coordinates: a roll with no route.
  const many = (n: number) => ids(n).map((id, i) => item(id, { takenAt: Date.parse("2027-01-12T16:10:00Z") + i * 60_000 }));
  const revealed = (over: Partial<tripActions.Trip> = {}) => detail({ revealed: true, ...over });

  async function openSheet(d = revealed(), items = many(10), kind: "collage" | "journey" = "collage") {
    await open(kind, d, items);
    await screen.findByRole("button", { name: kind === "collage" ? "Instagram" : "Más opciones" });
  }
  const toResumen = async () => fireEvent.press(await screen.findByRole("button", { name: "Resumen" }));

  beforeEach(() => {
    useSheetFilm.mockReset();
    useSheetFilm.mockReturnValue(readyFilm());
    exportFile.mockReset();
    exportFile.mockResolvedValue(FILE);
    video.saveVideo.mockResolvedValue(undefined);
    video.shareVideoMore.mockResolvedValue(undefined);
    video.shareVideoToInstagramApp.mockResolvedValue("stories");
  });

  it("an event with 10 shareable photos shows Collage | Resumen", async () => {
    await openSheet(revealed({ type: "event" }));
    expect(screen.getByRole("button", { name: "Collage" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Resumen" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Recorrido" })).toBeNull();
  });

  it("a trip roll in one place shows Resumen", async () => {
    await openSheet();
    expect(screen.getByRole("button", { name: "Resumen" })).toBeVisible();
  });

  it("a trip roll with a route and 10 photos shows Recorrido and Resumen", async () => {
    const at = (id: string, lat: number, lng: number) => item(id, { lat, lng });
    const places = [at("a", -41.13, -71.31), at("b", -41.14, -71.32), at("c", -42.9, -71.3), at("d", -42.91, -71.31), ...many(6).map((it) => at(it.id, -41.2, -71.3))];
    await openSheet(revealed(), places);
    expect(screen.getByRole("button", { name: "Recorrido" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Resumen" })).toBeVisible();
  });

  it.each([
    ["a private roll", () => revealed({ featuringDisabled: true }), () => many(10)],
    ["a roll with 5 shareable photos", () => revealed(), () => many(5)],
  ])("%s shows no control", async (_name, make, items) => {
    await open("collage", make(), items());
    await screen.findByLabelText(/Vista previa|Armando/).catch(() => undefined);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Resumen" })).toBeNull());
    expect(screen.queryByRole("button", { name: "Recorrido" })).toBeNull();
  });

  it("shows no control when the build has no video module", async () => {
    mockVideoAvailable = false;
    await open("collage", revealed(), many(10));
    await filesReady();
    expect(screen.queryByRole("button", { name: "Resumen" })).toBeNull();
  });

  it("kind=journey opens on Resumen when the roll has no route", async () => {
    await openSheet(revealed(), many(10), "journey");
    expect(screen.getByTestId("film-player")).toBeVisible();
  });

  it("Resumen: shows the player, the counter and the three pills", async () => {
    await openSheet();
    await toResumen();
    expect(await screen.findByTestId("film-player")).toHaveProp("accessibilityLabel", "playing");
    expect(screen.getByText("10 destacadas · 0 en la hoja")).toBeVisible();
    expect(screen.getByRole("button", { name: "Instagram" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Guardar video" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Más opciones" })).toBeVisible();
    expect(screen.getByLabelText("Elegir fotos")).toHaveProp("accessibilityHint", "El resumen tiene 10 fotos");
  });

  it("Resumen: the strip's hint counts the sheet's photos, not the highlights", async () => {
    await openSheet(revealed(), many(14));
    await toResumen();
    expect(await screen.findByText("12 destacadas · 2 en la hoja")).toBeVisible();
    expect(screen.getByLabelText("Elegir fotos")).toHaveProp("accessibilityHint", "El resumen tiene 14 fotos");
  });

  it("Resumen: the strip's plus opens the sheet picker", async () => {
    await openSheet();
    await toResumen();
    await fireEvent.press(await screen.findByRole("button", { name: "Elegir fotos" }));
    expect(screen).toHavePathname("/share-pick");
    expect(screen).toHaveSearchParams({ tripId: SUR, kind: "sheet" });
  });

  it("Guardar video exports once and saves", async () => {
    await openSheet();
    await toResumen();
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar video" }));
    await waitFor(() => expect(video.saveVideo).toHaveBeenCalledWith(FILE.uri));
    expect(Burnt.toast).toHaveBeenCalledWith({ title: "Guardado en Fotos", preset: "done" });
    expect(exportFile).toHaveBeenCalledTimes(1);
    expect(exportFile.mock.calls[0]![1]).toEqual({ tripId: SUR });
  });

  it("few shows the notice and no pills, keeping the strip and the counter", async () => {
    useSheetFilm.mockReturnValue({ status: "few" });
    await openSheet();
    await toResumen();
    expect(await screen.findByText("Faltan fotos para el resumen: dejá al menos 6 en la hoja.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Guardar video" })).toBeNull();
    expect(screen.getByLabelText("Elegir fotos")).toBeVisible();
    expect(screen.getByText("10 destacadas · 0 en la hoja")).toBeVisible();
  });

  it("taking photos out until fewer than 6 remain keeps Resumen, the notice and the plus", async () => {
    useSheetFilm.mockReturnValue({ status: "few" });
    await act(async () => setSheetChoices(SUR, Object.fromEntries(ids(10).map((id) => [id, "out" as const]))));
    await openSheet();
    await toResumen();
    expect(await screen.findByText("Faltan fotos para el resumen: dejá al menos 6 en la hoja.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Resumen" })).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Elegir fotos" }));
    expect(screen).toHavePathname("/share-pick");
    expect(screen).toHaveSearchParams({ tripId: SUR, kind: "sheet" });
  });

  it("loading and error texts are the summary's", async () => {
    useSheetFilm.mockReturnValue({ status: "loading", done: 2, total: 5 });
    await openSheet();
    await toResumen();
    expect(await screen.findByText("Armando el resumen… 40 %")).toBeVisible();
    const retry = jest.fn();
    useSheetFilm.mockReturnValue({ status: "error", offline: false, retry });
    await act(async () => setSheetChoices(SUR, { p00: "sheet" }));
    expect(await screen.findByText("No se pudo armar el resumen. Probá de nuevo.")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(retry).toHaveBeenCalled();
  });

  it("changing the sheet choices during an export cancels it, and a later share exports again", async () => {
    let options!: Parameters<typeof filmExport.exportFilmToFile>[2];
    exportFile.mockImplementationOnce(
      (_film, _input, o) =>
        new Promise((resolve) => {
          options = o;
          const timer = setInterval(() => {
            if (o.isCancelled()) {
              clearInterval(timer);
              resolve(null);
            }
          }, 5);
        }),
    );
    await openSheet();
    await toResumen();
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar video" }));
    await waitFor(() => expect(exportFile).toHaveBeenCalledTimes(1));
    useSheetFilm.mockReturnValue(readyFilm("s2"));
    await act(async () => setSheetChoices(SUR, { p00: "out" }));
    expect(await screen.findByRole("button", { name: "Guardar video" })).toBeVisible();
    expect(options.isCancelled()).toBe(true);
    expect(video.saveVideo).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Guardar video" }));
    await waitFor(() => expect(video.saveVideo).toHaveBeenCalledTimes(1));
    expect(exportFile).toHaveBeenCalledTimes(2);
  });

  it("useSheetFilm only gets shareable, non-archived photos, in time order", async () => {
    const items = [...many(8).reverse(), item("hidden", { shareable: false }), item("gone", { archived: true })] as tripActions.Feed["items"];
    await openSheet(revealed(), items, "journey");
    await waitFor(() => expect(useSheetFilm.mock.calls.some((c) => c[0].cells.length > 0)).toBe(true));
    const last = useSheetFilm.mock.calls.at(-1)![0];
    expect(last.cells.map((p) => p.id)).toEqual(ids(8));
  });
});


describe("Compartir: Recorrido y Resumen juntos", () => {
  const useFilm = jest.mocked(filmHook.useFilm);
  const useSheetFilm = jest.mocked(sheetHook.useSheetFilm);
  const exportFile = jest.mocked(filmExport.exportFilmToFile);
  const video = jest.mocked(shareVideo);
  const FILE = { uri: "file:///cache/rollo-video.mp4", bytes: 1000, frames: 30 };
  const routeFilm = () =>
    ({ status: "ready", film: { kind: "route", scene: {}, assets: {}, durationMs: 30_000, restAt: 0, version: "r1" }, stops: [], photos: [] }) as unknown as filmHook.Film;
  const sheetFilm = () =>
    ({ status: "ready", film: { kind: "sheet", scene: {}, assets: {}, durationMs: 40_000, restAt: 0, version: "s1" }, photos: [] }) as unknown as sheetHook.SheetFilm;
  const at = (id: string, lat: number, lng: number) => item(id, { lat, lng, takenAt: Date.parse("2027-01-12T16:10:00Z") + id.length * 60_000 });
  const TWO_PLACES = [at("a", -41.13, -71.31), at("b", -41.14, -71.32), at("c", -42.9, -71.3), at("d", -42.91, -71.31)];
  const filler = (n: number) => Array.from({ length: n }, (_, i) => at(`f${String(i).padStart(2, "0")}`, -41.2, -71.3));
  const revealed = () => detail({ revealed: true });
  const press = async (name: string) => fireEvent.press(await screen.findByRole("button", { name }));

  beforeEach(() => {
    useFilm.mockReset();
    useFilm.mockReturnValue(routeFilm());
    useSheetFilm.mockReset();
    useSheetFilm.mockReturnValue(sheetFilm());
    exportFile.mockReset();
    exportFile.mockResolvedValue(FILE);
    video.saveVideo.mockResolvedValue(undefined);
    video.shareVideoMore.mockResolvedValue(undefined);
    video.shareVideoToInstagramApp.mockResolvedValue("stories");
  });

  async function openBoth(kind: "collage" | "journey" | "sheet" = "collage") {
    await open(kind, revealed(), [...TWO_PLACES, ...filler(6)]);
    await screen.findByRole("button", { name: kind === "collage" ? "Instagram" : "Más opciones" });
  }

  it("a roll with a route and 10 shareable photos shows the three segments, each rendering its piece", async () => {
    await openBoth();
    for (const name of ["Collage", "Recorrido", "Resumen"]) expect(screen.getByRole("button", { name })).toBeVisible();
    expect(screen.queryByTestId("film-player")).toBeNull();
    await press("Recorrido");
    expect(await screen.findByTestId("film-player")).toBeVisible();
    expect(screen.queryByText(/destacadas · /)).toBeNull();
    await press("Resumen");
    expect(await screen.findByText("10 destacadas · 0 en la hoja")).toBeVisible();
    await press("Collage");
    expect(await screen.findByLabelText("Vista previa")).toBeVisible();
    expect(screen.queryByTestId("film-player")).toBeNull();
  });

  it("a route with fewer than 6 shareable photos shows only Collage | Recorrido", async () => {
    await open("collage", revealed(), TWO_PLACES);
    await screen.findByRole("button", { name: "Instagram" });
    expect(screen.getByRole("button", { name: "Recorrido" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Resumen" })).toBeNull();
  });

  it("no route shows Collage | Resumen", async () => {
    await open("collage", revealed(), filler(8).map((it) => ({ ...it, lat: null, lng: null })));
    await screen.findByRole("button", { name: "Instagram" });
    expect(screen.getByRole("button", { name: "Resumen" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Recorrido" })).toBeNull();
  });

  it("kind=sheet opens on Resumen", async () => {
    await openBoth("sheet");
    expect(screen.getByTestId("film-player")).toBeVisible();
    expect(screen.getByText("10 destacadas · 0 en la hoja")).toBeVisible();
  });

  it("kind=journey with both opens on Recorrido", async () => {
    await openBoth("journey");
    expect(screen.getByTestId("film-player")).toBeVisible();
    expect(screen.queryByText(/destacadas · /)).toBeNull();
  });

  it("switching from Recorrido to Resumen mid-export cancels it, and Resumen exports its own file", async () => {
    let first!: Parameters<typeof filmExport.exportFilmToFile>[2];
    exportFile.mockImplementationOnce(
      (_film, _input, o) =>
        new Promise((resolve) => {
          first = o;
          const timer = setInterval(() => {
            if (o.isCancelled()) {
              clearInterval(timer);
              resolve(null);
            }
          }, 5);
        }),
    );
    await openBoth();
    await press("Recorrido");
    await press("Guardar video");
    await waitFor(() => expect(exportFile).toHaveBeenCalledTimes(1));
    await press("Resumen");
    await waitFor(() => expect(first.isCancelled()).toBe(true));
    expect(video.saveVideo).not.toHaveBeenCalled();
    await press("Guardar video");
    await waitFor(() => expect(video.saveVideo).toHaveBeenCalledTimes(1));
    expect(exportFile).toHaveBeenCalledTimes(2);
    expect(exportFile.mock.calls[1]![0]).toMatchObject({ kind: "sheet" });
  });
});
