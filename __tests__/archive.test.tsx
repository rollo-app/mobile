import { act } from "@testing-library/react-native";
import * as Burnt from "burnt";
import { Alert } from "react-native";
import { router } from "expo-router";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { GalleryScreen } from "@/features/gallery/gallery-screen";
import * as galleryActions from "@/features/gallery/actions";
import * as featuredActions from "@/features/featured/actions";
import * as actions from "@/features/trips/actions";
import { markPresentationSeen } from "@/storage/presentation";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/featured/actions");
jest.mock("@/features/likes/actions");
jest.mock("@/features/gallery/actions");
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success" },
  impactAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light" },
}));
const trips = jest.mocked(actions);
const gallery = jest.mocked(galleryActions);
const featured = jest.mocked(featuredActions);

const SUR = "11111111-1111-4111-8111-111111111111";
const DAY = 24 * 60 * 60 * 1000;
const MINE = { id: "m1", userId: "u1", name: "Juani", username: null, avatarUrl: null };
const FEDE = { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null };

const detail = (revealed = true): actions.TripDetail => ({
  trip: {
    id: SUR,
    name: "Viaje al sur",
    joinCode: "HUB5FT",
    timezone: "America/Argentina/Buenos_Aires",
    startsAt: Date.now() - 9 * DAY,
    endsAt: revealed ? Date.now() - 2 * DAY : Date.now() + DAY,
    revealAt: revealed ? Date.now() - DAY : Date.now() + DAY,
    revealed,
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
  me: { ...MINE, role: "member", isCreator: false, blockedByMe: false },
  members: [
    { ...MINE, role: "member", isCreator: false, blockedByMe: false },
    { ...FEDE, role: "admin", isCreator: false, blockedByMe: false },
  ],
  today: { date: "2027-01-12", photosLeft: 0, videosLeft: 0 },
  totalUploaded: 3,
});

const item = (id: string, over: Partial<actions.Feed["items"][number]> = {}): actions.Feed["items"][number] => ({
  id,
  type: "photo",
  takenAt: Date.parse("2027-01-12T16:10:00Z"),
  day: "2027-01-12",
  lat: null,
  lng: null,
  caption: null,
  thumbhash: null,
  durationS: null,
  author: MINE,
  width: 4000,
  height: 3000,
  files: { thumb: `/m/${id}/thumb`, original: `/m/${id}/original` },
  canFeature: true,
  archived: false,
  ...over,
});

const feed = (items: actions.Feed["items"], revealed = true): actions.Feed => ({
  revealed,
  revealAt: revealed ? Date.now() - DAY : Date.now() + DAY,
  items,
});

/** Mine ("a", "b") and Fede's ("f"), in that order. */
const three = () =>
  feed([
    item("a", { takenAt: Date.parse("2027-01-12T15:00:00Z") }),
    item("b", { takenAt: Date.parse("2027-01-12T16:00:00Z") }),
    item("f", { takenAt: Date.parse("2027-01-12T17:00:00Z"), author: FEDE }),
  ]);

const openGrid = () => renderRouter({ ...routes, gallery: () => <GalleryScreen tripId={SUR} /> }, { initialUrl: "/gallery" });
const openViewer = (id: string) => renderRouter(routes, { initialUrl: `/photo/${id}?tripId=${SUR}` });
let alert: jest.SpyInstance;
/** Presses a button of the last native Alert. */
const pressAlert = (text: string) =>
  act(async () => {
    const buttons = alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === text)!.onPress?.();
  });

beforeEach(async () => {
  trips.fetchTrip.mockResolvedValue(detail());
  trips.fetchFeed.mockResolvedValue(three());
  gallery.archiveMedia.mockReset().mockResolvedValue(undefined);
  gallery.unarchiveMedia.mockReset().mockResolvedValue(undefined);
  gallery.deleteMedia.mockReset().mockResolvedValue(undefined);
  featured.featureMedia.mockReset().mockResolvedValue(undefined);
  jest.mocked(Burnt.alert).mockClear();
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await markPresentationSeen(SUR);
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur", { revealed: true })] });
});
afterEach(() => alert.mockRestore());

describe("Gallery grid: archive and delete your photos", () => {
  it("only your own photos offer Archivar and Eliminar", async () => {
    await openGrid();
    await screen.findAllByRole("button", { name: /Foto de Juani/ });
    expect(screen.getAllByRole("menuitem", { name: "Archivar" })).toHaveLength(2);
    expect(screen.getAllByRole("menuitem", { name: "Eliminar" })).toHaveLength(2);
  });

  it("Archivar archives it right away (no confirmation): it shows dimmed with Archivada and offers Desarchivar", async () => {
    await openGrid();
    await fireEvent.press((await screen.findAllByRole("menuitem", { name: "Archivar" }))[0]!);
    expect(alert).not.toHaveBeenCalled();
    await waitFor(() => expect(gallery.archiveMedia).toHaveBeenCalledWith("a"));
    expect(await screen.findByText("Archivada")).toBeVisible();
    expect(screen.getAllByRole("menuitem", { name: "Desarchivar" })).toHaveLength(1);
  });

  it("an archived photo from the server shows Archivada, has no Agregar a tu perfil, and Desarchivar unarchives it", async () => {
    trips.fetchFeed.mockResolvedValue(feed([item("a", { archived: true })]));
    await openGrid();
    expect(await screen.findByText("Archivada")).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: "Agregar a tu perfil" })).toBeNull();
    await fireEvent.press(screen.getByRole("menuitem", { name: "Desarchivar" }));
    await waitFor(() => expect(gallery.unarchiveMedia).toHaveBeenCalledWith("a"));
    await waitFor(() => expect(screen.queryByText("Archivada")).toBeNull());
  });

  it("if archiving fails it goes back and says so with a native alert", async () => {
    gallery.archiveMedia.mockRejectedValue(new Error("sin señal"));
    await openGrid();
    await fireEvent.press((await screen.findAllByRole("menuitem", { name: "Archivar" }))[0]!);
    await waitFor(() => expect(Burnt.alert).toHaveBeenCalledWith(expect.objectContaining({ preset: "error", title: "No se pudo archivar" })));
    await waitFor(() => expect(screen.queryByText("Archivada")).toBeNull());
    expect(screen.getAllByRole("menuitem", { name: "Archivar" })).toHaveLength(2);
  });

  it("Eliminar asks first and, confirmed, deletes it from the grid", async () => {
    await openGrid();
    await fireEvent.press((await screen.findAllByRole("menuitem", { name: "Eliminar" }))[0]!);
    expect(alert).toHaveBeenCalledWith("¿Eliminar esta foto?", "No se puede deshacer.", expect.any(Array));
    const buttons = alert.mock.calls[0]![2] as { text: string; style?: string }[];
    expect(buttons.find((b) => b.text === "Eliminar")!.style).toBe("destructive");
    expect(gallery.deleteMedia).not.toHaveBeenCalled();

    trips.fetchFeed.mockResolvedValue(feed([three().items[1]!, three().items[2]!]));
    await pressAlert("Eliminar");
    await waitFor(() => expect(gallery.deleteMedia).toHaveBeenCalledWith("a"));
    await waitFor(() => expect(screen.getAllByRole("menuitem", { name: "Eliminar" })).toHaveLength(1));
  });

  it("cancelling the alert deletes nothing", async () => {
    await openGrid();
    await fireEvent.press((await screen.findAllByRole("menuitem", { name: "Eliminar" }))[0]!);
    await pressAlert("Cancelar");
    expect(gallery.deleteMedia).not.toHaveBeenCalled();
  });

  it("if deleting fails the photo stays and a native alert says so", async () => {
    gallery.deleteMedia.mockRejectedValue(new Error("sin señal"));
    await openGrid();
    await fireEvent.press((await screen.findAllByRole("menuitem", { name: "Eliminar" }))[0]!);
    await pressAlert("Eliminar");
    await waitFor(() => expect(Burnt.alert).toHaveBeenCalledWith(expect.objectContaining({ preset: "error", title: "No se pudo eliminar" })));
    expect(screen.getAllByRole("menuitem", { name: "Eliminar" })).toHaveLength(2);
  });
});

describe("Photo viewer: archive and delete your photo", () => {
  it("the … menu of your photo offers Archivar and Eliminar", async () => {
    await openViewer("a");
    expect(await screen.findByRole("menuitem", { name: "Archivar" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Eliminar" })).toBeTruthy();
  });

  it("someone else's photo has neither", async () => {
    await openViewer("f");
    await screen.findByRole("menuitem", { name: "Denunciar" });
    expect(screen.queryByRole("menuitem", { name: "Archivar" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Eliminar" })).toBeNull();
  });

  it("Archivar marks it Archivada and the menu then offers Desarchivar", async () => {
    await openViewer("a");
    await fireEvent.press(await screen.findByRole("menuitem", { name: "Archivar" }));
    await waitFor(() => expect(gallery.archiveMedia).toHaveBeenCalledWith("a"));
    expect(await screen.findByText("Archivada")).toBeVisible();
    await fireEvent.press(await screen.findByRole("menuitem", { name: "Desarchivar" }));
    await waitFor(() => expect(gallery.unarchiveMedia).toHaveBeenCalledWith("a"));
  });

  it("an archived photo can't be added to your profile from the viewer", async () => {
    trips.fetchFeed.mockResolvedValue(feed([item("a", { archived: true })]));
    await openViewer("a");
    expect(await screen.findByText("Archivada")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Agregar a tu perfil" })).toBeNull();
  });

  it("after deleting, the next photo shows", async () => {
    await openViewer("a");
    await fireEvent.press(await screen.findByRole("menuitem", { name: "Eliminar" }));
    trips.fetchFeed.mockResolvedValue(feed([three().items[1]!, three().items[2]!]));
    await pressAlert("Eliminar");
    await waitFor(() => expect(gallery.deleteMedia).toHaveBeenCalledWith("a"));
    // "b" (mine) is now the photo on screen: its menu still offers Eliminar, and the viewer stays open.
    expect(await screen.findByRole("menuitem", { name: "Eliminar" })).toBeTruthy();
    expect(screen).toHavePathname("/photo/a");
  });

  it("deleting the last photo closes the viewer", async () => {
    trips.fetchFeed.mockResolvedValue(feed([item("only")]));
    await renderRouter(routes, { initialUrl: "/map" });
    await act(async () => router.push(`/photo/only?tripId=${SUR}`));
    await fireEvent.press(await screen.findByRole("menuitem", { name: "Eliminar" }));
    trips.fetchFeed.mockResolvedValue(feed([]));
    await pressAlert("Eliminar");
    await waitFor(() => expect(screen).toHavePathname("/map"));
  });

  it("if deleting fails the viewer stays on the photo with a native alert", async () => {
    gallery.deleteMedia.mockRejectedValue(new Error("sin señal"));
    await openViewer("a");
    await fireEvent.press(await screen.findByRole("menuitem", { name: "Eliminar" }));
    await pressAlert("Eliminar");
    await waitFor(() => expect(Burnt.alert).toHaveBeenCalledWith(expect.objectContaining({ preset: "error", title: "No se pudo eliminar" })));
    expect(screen.getByRole("menuitem", { name: "Eliminar" })).toBeTruthy();
  });

  it("before the reveal (a daily moment) there is neither Archivar nor Eliminar", async () => {
    trips.fetchTrip.mockResolvedValue(detail(false));
    trips.fetchFeed.mockResolvedValue(feed([item("mom", { momentDay: "2027-01-12" })], false));
    await openViewer("mom");
    await screen.findByTestId("viewer-info");
    expect(screen.queryByRole("menuitem", { name: "Archivar" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Eliminar" })).toBeNull();
  });
});

describe("your own videos (old rollos)", () => {
  const withVideo = () =>
    feed([
      item("a"),
      item("v", { type: "video", durationS: 9, canFeature: false, takenAt: Date.parse("2027-01-12T15:30:00Z") }),
      item("fv", { type: "video", durationS: 9, canFeature: false, author: FEDE, takenAt: Date.parse("2027-01-12T17:00:00Z") }),
    ]);

  it("grid: only your own video offers Archivar and Eliminar, never Agregar a tu perfil", async () => {
    trips.fetchFeed.mockResolvedValue(withVideo());
    await openGrid();
    await screen.findAllByRole("button", { name: /Video de Juani/ });
    expect(screen.getAllByRole("menuitem", { name: "Archivar" })).toHaveLength(2);
    expect(screen.getAllByRole("menuitem", { name: "Eliminar" })).toHaveLength(2);
    // Only the photo "a" can be featured; the videos never are.
    expect(screen.getAllByRole("menuitem", { name: "Agregar a tu perfil" })).toHaveLength(1);
  });

  it("grid: Archivar on the video archives it and Eliminar asks about the video", async () => {
    trips.fetchFeed.mockResolvedValue(withVideo());
    await openGrid();
    await screen.findAllByRole("button", { name: /Video de Juani/ });
    await fireEvent.press(screen.getAllByRole("menuitem", { name: "Archivar" })[0]!);
    await waitFor(() => expect(gallery.archiveMedia).toHaveBeenCalledWith("v"));
    await fireEvent.press(screen.getAllByRole("menuitem", { name: "Eliminar" })[0]!);
    expect(alert).toHaveBeenCalledWith("¿Eliminar este video?", "No se puede deshacer.", expect.any(Array));
    await pressAlert("Eliminar");
    await waitFor(() => expect(gallery.deleteMedia).toHaveBeenCalledWith("v"));
  });

  it("viewer: the … menu of your video offers Archivar and Eliminar (with the video copy)", async () => {
    trips.fetchFeed.mockResolvedValue(withVideo());
    await openViewer("v");
    expect(await screen.findByRole("menuitem", { name: "Archivar" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("menuitem", { name: "Eliminar" }));
    expect(alert).toHaveBeenCalledWith("¿Eliminar este video?", "No se puede deshacer.", expect.any(Array));
  });

  it("viewer: someone else's video has neither", async () => {
    trips.fetchFeed.mockResolvedValue(withVideo());
    await openViewer("fv");
    await screen.findByRole("menuitem", { name: "Denunciar" });
    expect(screen.queryByRole("menuitem", { name: "Archivar" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Eliminar" })).toBeNull();
  });
});
