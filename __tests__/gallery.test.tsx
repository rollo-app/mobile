import { act } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";
import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import { GalleryScreen } from "@/features/gallery/gallery-screen";
import { PermissionDeniedError } from "@/features/gallery/save";
import * as actions from "@/features/trips/actions";
import { markPresentationSeen } from "@/storage/presentation";
import { saveSession } from "@/storage/trips";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success" },
}));
const mockSaveOne = jest.fn();
jest.mock("@/features/gallery/save", () => ({
  ...jest.requireActual("@/features/gallery/save"),
  createSaver: jest.fn(() => (photo: unknown) => mockSaveOne(photo)),
}));
const mocked = jest.mocked(actions);
const { __camera: camera } = jest.requireMock("@maplibre/maplibre-react-native") as { __camera: { flyTo: jest.Mock } };

const SUR = "11111111-1111-4111-8111-111111111111";
const DAY = 24 * 60 * 60 * 1000;

const detail = (): actions.TripDetail => ({
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
  },
  me: { id: "m1", name: "Juani", role: "admin" },
  members: [
    { id: "m1", name: "Juani", role: "admin" },
    { id: "m2", name: "Fede", role: "member" },
  ],
  today: { date: "2027-01-12", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 3,
});

const item = (id: string, over: Partial<actions.Feed["items"][number]> = {}): actions.Feed["items"][number] => ({
  id,
  type: "photo",
  takenAt: Date.parse("2027-01-12T16:10:00Z"),
  day: "2027-01-12",
  lat: -49.33,
  lng: -72.89,
  caption: null,
  thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
  durationS: null,
  author: { id: "m2", name: "Fede" },
  width: 4000,
  height: 3000,
  files: { thumb: `/m/${id}/thumb`, original: `/m/${id}/original` },
  ...over,
});

const feed = (items: actions.Feed["items"]): actions.Feed => ({ revealed: true, revealAt: Date.now() - DAY, items });

const galleryRoutes = { ...routes, gallery: () => <GalleryScreen tripId={SUR} /> };
let alert: jest.SpyInstance;

beforeEach(async () => {
  mockSaveOne.mockReset().mockResolvedValue(undefined);
  mocked.fetchTrip.mockResolvedValue(detail());
  mocked.fetchFeed.mockResolvedValue(feed([]));
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await markPresentationSeen(SUR); // the first-open presentation would cover these screens
  await saveSession({ tripId: SUR, tripName: "Viaje al sur", joinCode: "HUB5FT", memberId: "m1", memberName: "Juani", role: "admin", token: "t" });
});
afterEach(() => alert.mockRestore());

const confirmSave = () =>
  act(async () => {
    (alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[]).find((b) => b.text === "Guardar")!.onPress!();
  });
const open = () => renderRouter(galleryRoutes, { initialUrl: "/gallery" });
const two = () =>
  feed([
    item("a", { takenAt: Date.parse("2027-01-12T15:00:00Z") }),
    item("b", { takenAt: Date.parse("2027-01-12T16:00:00Z"), author: { id: "m1", name: "Juani" }, caption: "el glaciar" }),
    item("c", { day: "2027-01-13", takenAt: Date.parse("2027-01-13T16:00:00Z"), type: "video", durationS: 12 }),
  ]);

describe("Gallery", () => {
  it("groups by day with a header", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    await open();
    expect(await screen.findByText("Martes 12 de enero")).toBeVisible();
    expect(screen.getByText("Miércoles 13 de enero")).toBeVisible();
    expect(screen.getAllByRole("button", { name: /^(Foto|Video) de / })).toHaveLength(3);
    expect(screen.getByText("0:12")).toBeVisible();
  });

  it("filters by person", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    await open();
    await screen.findByText("Martes 12 de enero");
    await fireEvent.press(screen.getByRole("menuitem", { name: "Juani" }));
    expect(screen.getAllByRole("button", { name: /^(Foto|Video) de / })).toHaveLength(1);
    expect(screen.queryByText("Miércoles 13 de enero")).toBeNull();
    await fireEvent.press(screen.getByRole("menuitem", { name: "Todos" }));
    expect(screen.getAllByRole("button", { name: /^(Foto|Video) de / })).toHaveLength(3);
  });

  it("shows an empty state", async () => {
    await open();
    expect(await screen.findByText("Este rollo no tiene fotos")).toBeVisible();
  });

  it("shows an error with Reintentar", async () => {
    mocked.fetchFeed.mockRejectedValueOnce(new Error("Sin conexión"));
    await open();
    expect(await screen.findByText("Sin conexión")).toBeVisible();
    mocked.fetchFeed.mockResolvedValue(two());
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Martes 12 de enero")).toBeVisible();
  });

  it("tapping a photo opens the viewer on it", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    await open();
    await fireEvent.press((await screen.findAllByRole("button", { name: "Foto de Juani" }))[0]!);
    await waitFor(() => expect(screen).toHavePathname("/photo/b"));
    expect(await screen.findByText("el glaciar")).toBeVisible();
  });

  it("selects several and saves them", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    await open();
    await screen.findByText("Martes 12 de enero");
    await fireEvent.press(screen.getByRole("button", { name: "Seleccionar" }));
    const [a, b] = screen.getAllByRole("button", { name: /^(Foto|Video) de / });
    await fireEvent.press(a!);
    await fireEvent.press(b!);
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar (2)" }));
    await waitFor(() => expect(mockSaveOne).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Guardadas 2 ✓")).toBeVisible();
    // Selection mode is over.
    expect(screen.getByRole("button", { name: "Seleccionar" })).toBeVisible();
  });

  it("Guardar todo asks for confirmation with the estimated size and then saves everything", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    await open();
    await screen.findByText("Martes 12 de enero");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar todo" }));
    expect(alert).toHaveBeenCalledWith("Guardar 3 fotos en Fotos", expect.stringMatching(/^Ocupa ~\d+ MB\. Conviene Wi-Fi\.$/), expect.any(Array));
    expect(mockSaveOne).not.toHaveBeenCalled();

    await confirmSave();
    await waitFor(() => expect(mockSaveOne).toHaveBeenCalledTimes(3));
    expect(await screen.findByText("Guardadas 3 ✓")).toBeVisible();
  });

  it("reports how many could not be saved", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    mockSaveOne.mockImplementation(async (p: { id: string }) => {
      if (p.id === "a") throw new Error("red");
    });
    await open();
    await screen.findByText("Martes 12 de enero");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar todo" }));
    await confirmSave();
    expect(await screen.findByText("Se guardaron 2. No se pudieron guardar 1 foto.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });

  it("offers Abrir Ajustes when the permission was denied", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    mockSaveOne.mockRejectedValue(new PermissionDeniedError(false));
    const settings = jest.spyOn(Linking, "openSettings").mockResolvedValue();
    await open();
    await screen.findByText("Martes 12 de enero");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar todo" }));
    await confirmSave();
    await fireEvent.press(await screen.findByRole("button", { name: "Abrir Ajustes" }));
    expect(settings).toHaveBeenCalled();
  });
});

describe("Photo viewer", () => {
  const openViewer = async (id = "b") => {
    mocked.fetchFeed.mockResolvedValue(two());
    await renderRouter(routes, { initialUrl: `/photo/${id}?tripId=${SUR}` });
  };

  it("starts on the photo that was tapped with author, time and caption", async () => {
    await openViewer("b");
    expect(await screen.findByText("el glaciar")).toBeVisible();
    expect(screen.getByText("Juani")).toBeVisible();
    expect(screen.getByRole("button", { name: "Ver en el mapa" })).toBeVisible();
  });

  it("tap hides and shows the overlay", async () => {
    await openViewer("b");
    await screen.findByText("el glaciar");
    await fireEvent.press(screen.getByLabelText("Foto de Juani"));
    expect(screen.queryByText("el glaciar")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Foto de Juani"));
    expect(screen.getByText("el glaciar")).toBeVisible();
  });

  it("Ver en el mapa goes to the map focused on the photo", async () => {
    await openViewer("b");
    await fireEvent.press(await screen.findByRole("button", { name: "Ver en el mapa" }));
    await waitFor(() => expect(screen).toHavePathname("/map"));
    await waitFor(() => expect(camera.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [-72.89, -49.33] })));
  });

  it("hides Ver en el mapa for a photo without location", async () => {
    mocked.fetchFeed.mockResolvedValue(feed([item("n", { lat: null, lng: null })]));
    await renderRouter(routes, { initialUrl: `/photo/n?tripId=${SUR}` });
    await screen.findByRole("button", { name: "Guardar en Fotos" });
    expect(screen.queryByRole("button", { name: "Ver en el mapa" })).toBeNull();
  });

  it("saves the original and shows Guardada ✓", async () => {
    await openViewer("b");
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar en Fotos" }));
    expect(await screen.findByText("Guardada ✓")).toBeVisible();
    expect(mockSaveOne).toHaveBeenCalledWith(expect.objectContaining({ id: "b", originalPath: "/m/b/original" }));
  });

  it("shows Abrir Ajustes if the permission is denied", async () => {
    mockSaveOne.mockRejectedValue(new PermissionDeniedError(false));
    await openViewer("b");
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar en Fotos" }));
    expect(await screen.findByRole("button", { name: "Abrir Ajustes" })).toBeVisible();
  });
});
