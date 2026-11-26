import { act } from "@testing-library/react-native";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import "@/test/reanimated";
import { GalleryScreen } from "@/features/gallery/gallery-screen";
import { RollVideoBanner } from "@/features/share/roll-video-banner";
import * as actions from "@/features/trips/actions";
import { markPresentationSeen } from "@/storage/presentation";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";
import { keepOriginals } from "@/test/trip";

jest.mock("@/features/trips/actions");
jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: false })),
  getLastKnownPositionAsync: jest.fn(async () => null),
  getCurrentPositionAsync: jest.fn(async () => null),
  Accuracy: { Balanced: 3, High: 5 },
  reverseGeocodeAsync: jest.fn(async () => []),
}));
let mockVideoAvailable = true;
jest.mock("../modules/rollo-video", () => ({
  get videoAvailable() {
    return mockVideoAvailable;
  },
  cancelVideo: jest.fn(),
}));
const mocked = jest.mocked(actions);

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

const at = (id: string, lat: number, lng: number, over: Partial<actions.Feed["items"][number]> = {}) => item(id, { lat, lng, ...over });
// Two places far apart: a route of two stops.
const TWO_PLACES = [at("a", -41.13, -71.31), at("b", -41.14, -71.32), at("c", -42.9, -71.3), at("d", -42.91, -71.31)];
const filler = (n: number) => Array.from({ length: n }, (_, i) => item(`f${String(i).padStart(2, "0")}`, { takenAt: Date.parse("2027-01-12T16:10:00Z") + i * 60_000 }));

const galleryRoutes = {
  ...routes,
  gallery: () => <GalleryScreen tripId={SUR} videoBanner={<RollVideoBanner tripId={SUR} />} />,
  "roll-video": () => null,
};
const open = async (d = detail(), items: actions.Feed["items"] = [...TWO_PLACES, ...filler(6)]) => {
  mocked.fetchTrip.mockResolvedValue(d);
  mocked.fetchFeedPage.mockResolvedValue(feed(items));
  await renderRouter(galleryRoutes, { initialUrl: "/gallery" });
  await screen.findByTestId("gallery-heading");
};

beforeEach(async () => {
  mockVideoAvailable = true;
  mocked.fetchTrip.mockReset();
  mocked.fetchFeedPage.mockReset();
  await markPresentationSeen(SUR);
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
});

describe("Gallery: the roll's video banner", () => {
  it("shows the title and Recorrido when the roll has a route", async () => {
    await open();
    expect(await screen.findByText("El video de tu rollo")).toBeVisible();
    expect(screen.getByText("Recorrido · Resumen")).toBeVisible();
    expect(screen.getByRole("button", { name: "Ver el video" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Compartir el video" })).toBeVisible();
  });

  it("shows only Recorrido when only the route exists", async () => {
    await open(detail(), TWO_PLACES);
    expect(await screen.findByText("Recorrido")).toBeVisible();
  });

  it("shows Resumen when only the sheet exists", async () => {
    await open(detail(), filler(8));
    expect(await screen.findByText("Resumen")).toBeVisible();
    expect(screen.queryByText("Recorrido")).toBeNull();
  });

  it("is absent when the roll has no video", async () => {
    await open(detail(), filler(3));
    await act(async () => {});
    expect(screen.queryByText("El video de tu rollo")).toBeNull();
  });

  it("is absent in a build without the video module", async () => {
    mockVideoAvailable = false;
    await open();
    await act(async () => {});
    expect(screen.queryByText("El video de tu rollo")).toBeNull();
  });

  it("is absent on a private roll", async () => {
    await open(detail({ featuringDisabled: true }));
    await act(async () => {});
    expect(screen.queryByText("El video de tu rollo")).toBeNull();
  });

  it("goes away while selecting and comes back after", async () => {
    await open();
    await screen.findByText("El video de tu rollo");
    await fireEvent.press(screen.getByRole("button", { name: "Seleccionar" }));
    await waitFor(() => expect(screen.queryByText("El video de tu rollo")).toBeNull());
    await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }));
    expect(await screen.findByText("El video de tu rollo")).toBeVisible();
  });

  it("play opens the player with the first kind", async () => {
    await open();
    await fireEvent.press(await screen.findByRole("button", { name: "Ver el video" }));
    await waitFor(() => expect(screen).toHavePathname("/roll-video"));
    expect(screen).toHaveSearchParams({ tripId: SUR, kind: "route" });
  });

  it("tapping the card plays too", async () => {
    await open(detail(), filler(8));
    await fireEvent.press(await screen.findByTestId("roll-video-banner"));
    await waitFor(() => expect(screen).toHavePathname("/roll-video"));
    expect(screen).toHaveSearchParams({ tripId: SUR, kind: "sheet" });
  });

  it("share opens Compartir on the matching piece", async () => {
    await open();
    await fireEvent.press(await screen.findByRole("button", { name: "Compartir el video" }));
    await waitFor(() => expect(screen).toHavePathname("/share-story"));
    expect(screen).toHaveSearchParams({ tripId: SUR, kind: "journey" });
  });

  it("share of a sheet-only roll opens the summary", async () => {
    await open(detail(), filler(8));
    await fireEvent.press(await screen.findByRole("button", { name: "Compartir el video" }));
    await waitFor(() => expect(screen).toHavePathname("/share-story"));
    expect(screen).toHaveSearchParams({ tripId: SUR, kind: "sheet" });
  });

  it("uses the roll's cover as the background when it has one", async () => {
    await open(detail({ coverUrl: "/c/cover.jpg" }));
    const image = await screen.findByTestId("roll-video-banner-image");
    expect(image.props.source[0].uri).toContain("/c/cover.jpg");
  });

  it("otherwise uses the thumbnail of the most liked photo", async () => {
    const items = [...TWO_PLACES, ...filler(6)].map((it) => (it.id === "c" ? { ...it, likeCount: 7 } : it));
    await open(detail(), items);
    const image = await screen.findByTestId("roll-video-banner-image");
    expect(image.props.source[0].uri).toContain("/m/c/thumb");
  });
});
