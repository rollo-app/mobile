import * as Clipboard from "expo-clipboard";
import * as Burnt from "burnt";
import { Linking } from "react-native";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import "@/test/reanimated";
import { joinLinkUrl } from "@/features/events/join-link";
import * as composeStillModule from "@/features/share/compose-still";
import { setCollageSelection } from "@/features/share/collage-selection";
import * as renderCollageModule from "@/features/share/render-collage";
import * as shareStory from "@/features/share/share-story";
import * as tripActions from "@/features/trips/actions";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";
import { keepOriginals } from "@/test/trip";

jest.mock("@/features/trips/actions");
jest.mock("@/features/share/render-collage", () => ({ renderCollageCard: jest.fn() }));
jest.mock("@/features/share/compose-still", () => ({ composeStill: jest.fn() }));
jest.mock("@/features/share/share-story", () => ({
  ...jest.requireActual("@/features/share/share-story"),
  writeShareFile: jest.fn(),
  whatsAppAvailable: jest.fn(),
  shareImageToWhatsApp: jest.fn(),
}));
const trips = jest.mocked(tripActions);
const collage = jest.mocked(renderCollageModule.renderCollageCard);
const still = jest.mocked(composeStillModule.composeStill);
const story = jest.mocked(shareStory);

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";

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

const item = (id: string): tripActions.Feed["items"][number] => ({
  groupIds: [],
  id,
  type: "photo",
  takenAt: Date.parse("2027-01-12T16:10:00Z"),
  day: "2027-01-12",
  lat: null,
  lng: null,
  caption: null,
  thumbhash: null,
  durationS: null,
  author: { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null },
  width: 4000,
  height: 3000,
  shareable: true,
  files: { thumb: `/m/${id}/thumb`, original: `/m/${id}/original` },
});

async function open(d: tripActions.TripDetail, items: tripActions.Feed["items"] = []) {
  trips.fetchTrip.mockResolvedValue(d);
  trips.fetchFeedPage.mockResolvedValue({ revealed: d.trip.revealed, revealAt: Date.now() - DAY, items, nextCursor: null });
  await renderRouter(routes, { initialUrl: `/share-roll?tripId=${SUR}` });
}

const revealed = () => detail({ revealed: true });

beforeEach(async () => {
  jest.clearAllMocks();
  for (const mock of Object.values(trips)) (mock as Partial<jest.Mock>).mockReset?.();
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
  collage.mockResolvedValue({ png: new Uint8Array([1]), width: 920, height: 1100 });
  still.mockResolvedValue(new Uint8Array([3]));
  story.writeShareFile.mockImplementation(async (_bytes, name) => `file:///cache/${name}`);
  story.whatsAppAvailable.mockResolvedValue(true);
  story.shareImageToWhatsApp.mockResolvedValue(undefined);
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
});

describe("Compartir sheet", () => {
  it("invite: lists Copiar link, WhatsApp and Instagram in order", async () => {
    await open(detail());
    await screen.findByRole("button", { name: "Copiar link" });
    expect(screen.getAllByRole("button").map((n) => n.props.accessibilityLabel)).toEqual(["Copiar link", "WhatsApp", "Instagram"]);
  });

  it("Copiar link copies the link, shows the HUD and closes the sheet", async () => {
    await open(detail());
    await fireEvent.press(await screen.findByRole("button", { name: "Copiar link" }));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith(joinLinkUrl("HUB5FT")));
    expect(Burnt.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Link copiado" }));
    await waitFor(() => expect(screen).not.toHavePathname("/share-roll"));
  });

  it("invite WhatsApp opens whatsapp:// with the invitation text", async () => {
    await open(detail());
    await fireEvent.press(await screen.findByRole("button", { name: "WhatsApp" }));
    await waitFor(() =>
      expect(Linking.openURL).toHaveBeenCalledWith(shareStory.whatsAppUrl(`Sumate a "Viaje al sur" en Rollo con el código HUB5FT: ${joinLinkUrl("HUB5FT")}`)),
    );
  });

  it("Instagram opens the Stories screen with the invitation", async () => {
    await open(detail());
    await fireEvent.press(await screen.findByRole("button", { name: "Instagram" }));
    await waitFor(() => expect(screen).toHavePathname("/share-story"));
    expect(screen).toHaveSearchParams({ tripId: SUR, kind: "invite" });
  });

  it("collage: WhatsApp and Instagram only; WhatsApp shares the dark still", async () => {
    await open(revealed(), [item("a"), item("b")]);
    await screen.findByRole("button", { name: "WhatsApp" });
    expect(screen.queryByRole("button", { name: "Copiar link" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "WhatsApp" }));
    await waitFor(() => expect(story.shareImageToWhatsApp).toHaveBeenCalledWith("file:///cache/rollo-collage-dark-whatsapp-still.jpg"));
    expect(collage.mock.calls[0]![0]).toMatchObject({ name: "Viaje al sur", style: "dark" });
    expect(still).toHaveBeenCalledWith(expect.anything(), "dark");
  });

  it("collage: WhatsApp sends the selected photos in order", async () => {
    setCollageSelection(SUR, ["b", "a"]);
    await open(revealed(), [item("a"), item("b"), item("c")]);
    await fireEvent.press(await screen.findByRole("button", { name: "WhatsApp" }));
    await waitFor(() => expect(story.shareImageToWhatsApp).toHaveBeenCalled());
    expect(collage.mock.calls[0]![0].photos.map((p) => p.id)).toEqual(["b", "a"]);
    setCollageSelection(SUR, []);
  });

  it("without WhatsApp installed the option is missing", async () => {
    story.whatsAppAvailable.mockResolvedValue(false);
    await open(detail());
    await screen.findByRole("button", { name: "Copiar link" });
    await waitFor(() => expect(screen.queryByRole("button", { name: "WhatsApp" })).toBeNull());
    expect(screen.getByRole("button", { name: "Instagram" })).toBeVisible();
  });

  it("a WhatsApp failure on the collage shows the inline error", async () => {
    story.shareImageToWhatsApp.mockRejectedValue(new Error("boom"));
    await open(revealed(), [item("a")]);
    await fireEvent.press(await screen.findByRole("button", { name: "WhatsApp" }));
    expect(await screen.findByText("No se pudo compartir. Probá de nuevo.")).toBeVisible();
  });

  it("the WhatsApp button is busy and disabled while the collage renders", async () => {
    collage.mockReturnValue(new Promise(() => {}));
    await open(revealed(), [item("a")]);
    await fireEvent.press(await screen.findByRole("button", { name: "WhatsApp" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "WhatsApp" })).toHaveProp("accessibilityState", { busy: true, disabled: true }));
  });

  it("shows the title and a loading state while the rollo loads", async () => {
    trips.fetchTrip.mockReturnValue(new Promise(() => {}));
    trips.fetchFeedPage.mockReturnValue(new Promise(() => {}));
    await renderRouter(routes, { initialUrl: `/share-roll?tripId=${SUR}` });
    expect(await screen.findByText("Compartir")).toBeVisible();
    expect(JSON.stringify(screen.toJSON())).toContain("ActivityIndicator");
  });

  it("a clipboard failure on Copiar link shows the inline error and keeps the sheet open", async () => {
    jest.mocked(Clipboard.setStringAsync).mockRejectedValueOnce(new Error("boom"));
    await open(detail());
    await fireEvent.press(await screen.findByRole("button", { name: "Copiar link" }));
    expect(await screen.findByText("No se pudo compartir. Probá de nuevo.")).toBeVisible();
    expect(Burnt.toast).not.toHaveBeenCalled();
    expect(screen).toHavePathname("/share-roll");
  });
});
