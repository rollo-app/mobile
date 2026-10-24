import { act } from "@testing-library/react-native";
import { ActionSheetIOS, Alert, Linking, Text } from "react-native";
import { router } from "expo-router";
import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import { requestPermissionsAsync } from "expo-media-library";
import { GalleryScreen } from "@/features/gallery/gallery-screen";
import { PermissionDeniedError } from "@/features/gallery/save";
import * as featuredActions from "@/features/featured/actions";
import * as likeActions from "@/features/likes/actions";
import * as moderationActions from "@/features/moderation/actions";
import * as actions from "@/features/trips/actions";
import { markPresentationSeen } from "@/storage/presentation";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/featured/actions");
jest.mock("@/features/likes/actions");
jest.mock("@/features/moderation/actions");
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success" },
  impactAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light" },
}));
const mockSaveOne = jest.fn();
const mockSaveOpts = jest.fn();
jest.mock("@/features/gallery/save", () => ({
  ...jest.requireActual("@/features/gallery/save"),
  createSaver: jest.fn(() => (photo: unknown, opts?: unknown) => {
    mockSaveOpts(opts);
    return mockSaveOne(photo);
  }),
}));
const mocked = jest.mocked(actions);
const featured = jest.mocked(featuredActions);
const likes = jest.mocked(likeActions);
const moderation = jest.mocked(moderationActions);
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
  me: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin", blockedByMe: false },
  members: [
    { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin", blockedByMe: false },
    { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null, role: "member", blockedByMe: false },
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
  author: { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null },
  width: 4000,
  height: 3000,
  files: { thumb: `/m/${id}/thumb`, original: `/m/${id}/original` },
  ...over,
});

const feed = (items: actions.Feed["items"]): actions.Feed => ({
  revealed: true,
  revealAt: Date.now() - DAY,
  items,
});

const galleryRoutes = {
  ...routes,
  gallery: () => <GalleryScreen tripId={SUR} />,
};
let alert: jest.SpyInstance;

beforeEach(async () => {
  mockSaveOpts.mockReset();
  jest.mocked(requestPermissionsAsync).mockClear();
  mockSaveOne.mockReset().mockResolvedValue(undefined);
  mocked.fetchTrip.mockResolvedValue(detail());
  mocked.fetchFeed.mockResolvedValue(feed([]));
  featured.featureMedia.mockReset().mockResolvedValue(undefined);
  featured.unfeatureMedia.mockReset().mockResolvedValue(undefined);
  featured.blockFeature.mockReset().mockResolvedValue(undefined);
  featured.unblockFeature.mockReset().mockResolvedValue(undefined);
  likes.likeMedia.mockReset().mockResolvedValue(undefined);
  likes.unlikeMedia.mockReset().mockResolvedValue(undefined);
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await markPresentationSeen(SUR); // the first-open presentation would cover these screens
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
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
    item("b", {
      takenAt: Date.parse("2027-01-12T16:00:00Z"),
      author: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null },
      caption: "el glaciar",
    }),
    item("c", {
      day: "2027-01-13",
      takenAt: Date.parse("2027-01-13T16:00:00Z"),
      type: "video",
      durationS: 12,
    }),
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
    expect(screen.queryByText("Solo Juani")).toBeNull();
    await fireEvent.press(screen.getByRole("menuitem", { name: "Juani" }));
    expect(screen.getAllByRole("button", { name: /^(Foto|Video) de / })).toHaveLength(1);
    expect(screen.queryByText("Miércoles 13 de enero")).toBeNull();
    expect(screen.getByText("Solo Juani")).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Juani" }).props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(screen.getByRole("menuitem", { name: "Todos" }));
    expect(screen.getAllByRole("button", { name: /^(Foto|Video) de / })).toHaveLength(3);
    expect(screen.queryByText("Solo Juani")).toBeNull();
  });

  it("the ✕ on the active filter goes back to everyone", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    await open();
    await screen.findByText("Martes 12 de enero");
    await fireEvent.press(screen.getByRole("menuitem", { name: "Fede" }));
    expect(screen.getByText("Solo Fede")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Quitar filtro" }));
    expect(screen.queryByText("Solo Fede")).toBeNull();
    expect(screen.getAllByRole("button", { name: /^(Foto|Video) de / })).toHaveLength(3);
  });

  it("the header title is Galería, not the route name", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    await open();
    await screen.findByText("Martes 12 de enero");
    expect(screen.queryByText("index")).toBeNull();
    expect(screen.queryByText("gallery")).toBeNull();
    expect(screen.queryByLabelText(/cambiar de rollo/)).toBeNull();
  });

  it("the ⋯ menu offers the filter and saving everything", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    await open();
    await screen.findByText("Martes 12 de enero");
    expect(screen.getByLabelText("Filtrar por persona")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Todos" }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByRole("menuitem", { name: "Guardar todo en Fotos" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Guardar todo" })).toBeNull();
  });

  it("has Seleccionar and the ⋯ menu together in the header toolbar", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    await open();
    await screen.findByText("Martes 12 de enero");
    expect(screen.getByRole("button", { name: "Seleccionar" })).toBeVisible();
    expect(screen.getByLabelText("Más opciones")).toBeTruthy();
  });

  it("Seleccionar todo selects every visible photo and toggles to Deseleccionar todo", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    await open();
    await screen.findByText("Martes 12 de enero");
    expect(screen.queryByRole("button", { name: "Seleccionar todo" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Seleccionar" }));
    await fireEvent.press(screen.getByRole("button", { name: "Seleccionar todo" }));
    expect(screen.getByRole("button", { name: "Guardar (3)" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Seleccionar todo" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Deseleccionar todo" }));
    expect(screen.getByRole("button", { name: "Guardar" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Seleccionar todo" })).toBeVisible();
  });

  it("Seleccionar todo respects the person filter", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    await open();
    await screen.findByText("Martes 12 de enero");
    await fireEvent.press(screen.getByRole("menuitem", { name: "Fede" }));
    await fireEvent.press(screen.getByRole("button", { name: "Seleccionar" }));
    await fireEvent.press(screen.getByRole("button", { name: "Seleccionar todo" }));
    expect(screen.getByRole("button", { name: "Guardar (2)" })).toBeVisible();
  });

  it("Seleccionar becomes Cancelar while selecting", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    await open();
    await screen.findByText("Martes 12 de enero");
    await fireEvent.press(screen.getByRole("button", { name: "Seleccionar" }));
    expect(screen.queryByRole("button", { name: "Seleccionar" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Seleccionar" })).toBeVisible();
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
    await fireEvent.press(screen.getByRole("menuitem", { name: "Guardar todo en Fotos" }));
    expect(alert).toHaveBeenCalledWith(
      "Guardar 3 fotos en Fotos",
      expect.stringMatching(
        /^Ocupa ~\d+ MB\. Conviene Wi-Fi\.\n\nPara crear el álbum «Rollo · Viaje al sur» iOS pide acceso a tus fotos\.$/,
      ),
      expect.any(Array),
    );
    expect(mockSaveOne).not.toHaveBeenCalled();

    await confirmSave();
    await waitFor(() => expect(mockSaveOne).toHaveBeenCalledTimes(3));
    expect(await screen.findByText("Guardadas 3 ✓")).toBeVisible();
  });

  it("Guardar todo asks for full access and saves into the album when granted", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    await open();
    await screen.findByText("Martes 12 de enero");
    await fireEvent.press(screen.getByRole("menuitem", { name: "Guardar todo en Fotos" }));
    await confirmSave();
    await waitFor(() => expect(mockSaveOne).toHaveBeenCalledTimes(3));
    expect(requestPermissionsAsync).toHaveBeenCalledWith(false);
    expect(mockSaveOpts).toHaveBeenCalledWith({ album: true });
    expect(await screen.findByText("Guardadas 3 ✓")).toBeVisible();
  });

  it("Guardar todo without full access saves to Recientes and says so", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    jest.mocked(requestPermissionsAsync).mockResolvedValueOnce({
      granted: true,
      canAskAgain: true,
      accessPrivileges: "limited",
    } as never);
    await open();
    await screen.findByText("Martes 12 de enero");
    await fireEvent.press(screen.getByRole("menuitem", { name: "Guardar todo en Fotos" }));
    await confirmSave();
    await waitFor(() => expect(mockSaveOne).toHaveBeenCalledTimes(3));
    expect(mockSaveOpts).toHaveBeenCalledWith({ album: false });
    expect(await screen.findByText("Se guardaron 3 fotos en Recientes")).toBeVisible();
  });

  it("saving a selection never uses the album", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    await open();
    await screen.findByText("Martes 12 de enero");
    await fireEvent.press(screen.getByRole("button", { name: "Seleccionar" }));
    await fireEvent.press(screen.getByRole("button", { name: "Seleccionar todo" }));
    await fireEvent.press(screen.getByRole("button", { name: "Guardar (3)" }));
    await waitFor(() => expect(mockSaveOne).toHaveBeenCalledTimes(3));
    expect(requestPermissionsAsync).not.toHaveBeenCalledWith(false);
    expect(mockSaveOpts).not.toHaveBeenCalledWith({ album: true });
  });

  it("reports how many could not be saved", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    mockSaveOne.mockImplementation(async (p: { id: string }) => {
      if (p.id === "a") throw new Error("red");
    });
    await open();
    await screen.findByText("Martes 12 de enero");
    await fireEvent.press(screen.getByRole("menuitem", { name: "Guardar todo en Fotos" }));
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
    await fireEvent.press(screen.getByRole("menuitem", { name: "Guardar todo en Fotos" }));
    await confirmSave();
    await fireEvent.press(await screen.findByRole("button", { name: "Abrir Ajustes" }));
    expect(settings).toHaveBeenCalled();
  });
});

describe("Gallery: featuring from the grid", () => {
  it("long-press menu on a photo features it and then offers to take it off", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    await open();
    await screen.findByText("Martes 12 de enero");
    // One menu per photo; videos can't be featured.
    expect(screen.getAllByRole("menuitem", { name: "Agregar a tu perfil" })).toHaveLength(2);
    await fireEvent.press(screen.getAllByRole("menuitem", { name: "Agregar a tu perfil" })[0]!);
    await waitFor(() => expect(featured.featureMedia).toHaveBeenCalledWith("a"));
    await fireEvent.press(await screen.findByRole("menuitem", { name: "Sacar de tu perfil" }));
    await waitFor(() => expect(featured.unfeatureMedia).toHaveBeenCalledWith("a"));
    await waitFor(() => expect(screen.getAllByRole("menuitem", { name: "Agregar a tu perfil" })).toHaveLength(2));
  });

  it("a photo already featured offers Sacar de tu perfil", async () => {
    mocked.fetchFeed.mockResolvedValue(feed([item("a", { featuredByMe: true })]));
    await open();
    expect(await screen.findByRole("menuitem", { name: "Sacar de tu perfil" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Agregar a tu perfil" })).toBeNull();
  });

  it("shows the server's error when featuring fails", async () => {
    featured.featureMedia.mockRejectedValue(new Error("Podés destacar hasta 60 fotos"));
    mocked.fetchFeed.mockResolvedValue(feed([item("a")]));
    await open();
    await fireEvent.press(await screen.findByRole("menuitem", { name: "Agregar a tu perfil" }));
    expect(await screen.findByText("Podés destacar hasta 60 fotos")).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Agregar a tu perfil" })).toBeTruthy();
  });

  it("there is no feature menu while selecting", async () => {
    mocked.fetchFeed.mockResolvedValue(two());
    await open();
    await screen.findAllByRole("menuitem", { name: "Agregar a tu perfil" });
    await fireEvent.press(screen.getByRole("button", { name: "Seleccionar" }));
    expect(screen.queryByRole("menuitem", { name: "Agregar a tu perfil" })).toBeNull();
  });
});

describe("Photo viewer", () => {
  const openViewer = async (id = "b") => {
    mocked.fetchFeed.mockResolvedValue(two());
    await renderRouter({ ...routes, "user/[id]": () => <Text>Perfil de alguien</Text> }, { initialUrl: `/photo/${id}?tripId=${SUR}` });
  };

  it("starts on the photo that was tapped with author, time and caption", async () => {
    await openViewer("b");
    expect(await screen.findByText("el glaciar")).toBeVisible();
    expect(screen.getByText("Juani")).toBeVisible();
    expect(screen.getByRole("button", { name: "Ver en el mapa" })).toBeVisible();
  });

  it("shows icon-only actions under the caption, without text labels", async () => {
    await openViewer("b");
    const info = within(await screen.findByTestId("viewer-info"));
    expect(info.getByRole("button", { name: "Me gusta" })).toBeVisible();
    expect(info.getByRole("button", { name: "Agregar a tu perfil" })).toBeVisible();
    expect(info.getByRole("button", { name: "Ver en el mapa" })).toBeVisible();
    expect(info.getByRole("button", { name: "Guardar en Fotos" })).toBeVisible();
    for (const text of ["Guardar en Fotos", "Ver en el mapa", "Agregar a tu perfil", "Me gusta"]) expect(screen.queryByText(text)).toBeNull();
  });

  it("puts Más opciones at the top, out of the bottom panel", async () => {
    await openViewer("a");
    await screen.findByText("Fede");
    expect(screen.getByLabelText("Más opciones")).toBeTruthy();
    expect(within(screen.getByTestId("viewer-info")).queryByLabelText("Más opciones")).toBeNull();
    expect(within(screen.getByTestId("viewer-info")).queryByRole("menuitem")).toBeNull();
  });

  it("double tap likes the photo without any heart animation", async () => {
    await openViewer("b");
    await screen.findByText("el glaciar");
    await fireEvent.press(screen.getByLabelText("Foto de Juani"));
    await fireEvent.press(screen.getByLabelText("Foto de Juani"));
    expect(await screen.findByRole("button", { name: "Ya no me gusta" })).toBeVisible();
    expect(screen.queryByTestId("heart-burst")).toBeNull();
  });

  it("tapping the author closes the viewer and opens their profile", async () => {
    await openViewer("a");
    await fireEvent.press(await screen.findByRole("button", { name: "Perfil de Fede" }));

    await waitFor(() => expect(screen).toHavePathname("/user/u-m2"));
    expect(await screen.findByText("Perfil de alguien")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Guardar en Fotos" })).toBeNull();
  });

  it("tap hides and shows the overlay", async () => {
    await openViewer("b");
    await screen.findByText("el glaciar");
    await fireEvent.press(screen.getByLabelText("Foto de Juani"));
    await waitFor(() => expect(screen.queryByText("el glaciar")).toBeNull());
    await fireEvent.press(screen.getByLabelText("Foto de Juani"));
    expect(await screen.findByText("el glaciar")).toBeVisible();
  });

  it("Ver en el mapa goes to the map focused on the photo", async () => {
    await openViewer("b");
    await fireEvent.press(await screen.findByRole("button", { name: "Ver en el mapa" }));
    await waitFor(() => expect(screen).toHavePathname("/map"));
    await waitFor(() =>
      expect(camera.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [-72.89, -49.33] })),
    );
  });

  it("hides Ver en el mapa for a photo without location", async () => {
    mocked.fetchFeed.mockResolvedValue(feed([item("n", { lat: null, lng: null })]));
    await renderRouter(routes, { initialUrl: `/photo/n?tripId=${SUR}` });
    await screen.findByRole("button", { name: "Guardar en Fotos" });
    expect(screen.queryByRole("button", { name: "Ver en el mapa" })).toBeNull();
  });

  it("saves the original and turns into Guardada", async () => {
    await openViewer("b");
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar en Fotos" }));
    expect(await screen.findByRole("button", { name: "Guardada" })).toBeVisible();
    expect(screen.queryByText("Guardada ✓")).toBeNull();
    expect(mockSaveOne).toHaveBeenCalledWith(expect.objectContaining({ id: "b", originalPath: "/m/b/original" }));
  });

  it("shows Abrir Ajustes if the permission is denied", async () => {
    mockSaveOne.mockRejectedValue(new PermissionDeniedError(false));
    await openViewer("b");
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar en Fotos" }));
    expect(await screen.findByRole("button", { name: "Abrir Ajustes" })).toBeVisible();
  });

  it("Agregar a tu perfil features the photo and turns into Sacar de tu perfil; again takes it off", async () => {
    await openViewer("b");
    expect(await screen.findByTestId("feature-symbol")).toHaveProp("name", "person.crop.circle.badge.plus");
    await fireEvent.press(await screen.findByRole("button", { name: "Agregar a tu perfil" }));
    expect(await screen.findByRole("button", { name: "Sacar de tu perfil" })).toBeVisible();
    expect(screen.getByTestId("feature-symbol")).toHaveProp("name", "person.crop.circle.badge.checkmark");
    expect(featured.featureMedia).toHaveBeenCalledWith("b");
    await fireEvent.press(screen.getByRole("button", { name: "Sacar de tu perfil" }));
    expect(await screen.findByRole("button", { name: "Agregar a tu perfil" })).toBeVisible();
    expect(featured.unfeatureMedia).toHaveBeenCalledWith("b");
  });

  it("pressing Agregar a tu perfil twice while the request is in flight sends it once", async () => {
    featured.featureMedia.mockReturnValue(new Promise(() => {}));
    await openViewer("b");
    await fireEvent.press(await screen.findByRole("button", { name: "Agregar a tu perfil" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Sacar de tu perfil" }));
    expect(featured.featureMedia).toHaveBeenCalledTimes(1);
    expect(featured.unfeatureMedia).not.toHaveBeenCalled();
  });

  it("shows the server's error inline and goes back to Agregar a tu perfil", async () => {
    featured.featureMedia.mockRejectedValue(new Error("Quien sacó esta foto no quiere que se destaque"));
    await openViewer("b");
    await fireEvent.press(await screen.findByRole("button", { name: "Agregar a tu perfil" }));
    expect(await screen.findByText("Quien sacó esta foto no quiere que se destaque")).toBeVisible();
    expect(screen.getByRole("button", { name: "Agregar a tu perfil" })).toBeVisible();
  });

  it("videos can't be featured", async () => {
    await openViewer("c");
    await screen.findByRole("button", { name: "Guardar en Fotos" });
    expect(screen.queryByRole("button", { name: "Agregar a tu perfil" })).toBeNull();
  });

  it("reports someone else's photo and moves on to the next one", async () => {
    // Like the server: once reported, the photo is gone from the refetched feed too.
    moderation.reportMedia.mockReset().mockImplementation(async () => {
      mocked.fetchFeed.mockResolvedValue(feed(two().items.filter((i) => i.id !== "a")));
    });
    const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_o, cb) => cb(0));
    await openViewer("a");
    await screen.findByText("Fede");

    await fireEvent.press(screen.getByRole("menuitem", { name: "Denunciar" }));

    await waitFor(() => expect(moderation.reportMedia).toHaveBeenCalledWith("a", "offensive"));
    expect(await screen.findByText("el glaciar")).toBeVisible();
    expect(screen.queryByText("Fede")).toBeNull();
    sheet.mockRestore();
  });

  it("reporting the last photo closes the viewer", async () => {
    moderation.reportMedia.mockReset().mockResolvedValue(undefined);
    const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_o, cb) => cb(0));
    mocked.fetchFeed.mockResolvedValue(feed([item("only")]));
    await renderRouter(routes, { initialUrl: "/map" });
    await act(async () => router.push(`/photo/only?tripId=${SUR}`));

    await fireEvent.press(await screen.findByRole("menuitem", { name: "Denunciar" }));

    await waitFor(() => expect(screen).toHavePathname("/map"));
    sheet.mockRestore();
  });

  it("your own photo has no Denunciar", async () => {
    const mine = { id: "m1", userId: "u1", name: "Juani", username: null, avatarUrl: null };
    mocked.fetchFeed.mockResolvedValue(feed([item("p", { author: mine })]));
    await renderRouter(routes, { initialUrl: `/photo/p?tripId=${SUR}` });
    await screen.findByRole("menuitem", { name: "No dejar que la destaquen" });
    expect(screen.queryByRole("menuitem", { name: "Denunciar" })).toBeNull();
  });

  it("someone else's photo has no feature-block option", async () => {
    await openViewer("a");
    await screen.findByRole("button", { name: "Agregar a tu perfil" });
    expect(screen.queryByRole("menuitem", { name: "No dejar que la destaquen" })).toBeNull();
  });

  it("the author can stop others from featuring it, and allow it again", async () => {
    const mine = { id: "m1", userId: "u1", name: "Juani", username: null, avatarUrl: null };
    mocked.fetchFeed.mockResolvedValue(feed([item("p", { author: mine })]));
    await renderRouter(routes, { initialUrl: `/photo/p?tripId=${SUR}` });
    mocked.fetchFeed.mockResolvedValue(feed([item("p", { author: mine, featureBlocked: true })]));
    await fireEvent.press(await screen.findByRole("menuitem", { name: "No dejar que la destaquen" }));
    expect(featured.blockFeature).toHaveBeenCalledWith("p");
    mocked.fetchFeed.mockResolvedValue(feed([item("p", { author: mine })]));
    await fireEvent.press(await screen.findByRole("menuitem", { name: "Dejar que la destaquen" }));
    expect(featured.unblockFeature).toHaveBeenCalledWith("p");
    expect(await screen.findByRole("menuitem", { name: "No dejar que la destaquen" })).toBeTruthy();
  });

  it("shows the error inline if blocking fails", async () => {
    featured.blockFeature.mockRejectedValue(new Error("No se pudo cambiar"));
    const mine = { id: "m1", userId: "u1", name: "Juani", username: null, avatarUrl: null };
    mocked.fetchFeed.mockResolvedValue(feed([item("p", { author: mine })]));
    await renderRouter(routes, { initialUrl: `/photo/p?tripId=${SUR}` });
    await fireEvent.press(await screen.findByRole("menuitem", { name: "No dejar que la destaquen" }));
    expect(await screen.findByText("No se pudo cambiar")).toBeVisible();
  });
});

describe("Photo viewer: likes", () => {
  const openOn = async (items: actions.Feed["items"], id: string) => {
    mocked.fetchFeed.mockResolvedValue(feed(items));
    await renderRouter(routes, { initialUrl: `/photo/${id}?tripId=${SUR}` });
  };
  const heart = () => screen.findByRole("button", { name: "Me gusta" });

  it("shows the heart with how many people like it, and liking adds yours", async () => {
    await openOn([item("a", { likeCount: 2 })], "a");
    const button = await heart();
    expect(within(button).getByText("2")).toBeVisible();

    await fireEvent.press(button);

    await waitFor(() => expect(within(screen.getByRole("button", { name: "Ya no me gusta" })).getByText("3")).toBeVisible());
    expect(likes.likeMedia).toHaveBeenCalledWith("a");
  });

  it("pressing it again takes your like away", async () => {
    await openOn([item("a", { likeCount: 1, likedByMe: true })], "a");
    await fireEvent.press(await screen.findByRole("button", { name: "Ya no me gusta" }));
    await waitFor(() => expect(likes.unlikeMedia).toHaveBeenCalledWith("a"));
    await waitFor(() => expect(within(screen.getByRole("button", { name: "Me gusta" })).queryByText("1")).toBeNull());
  });

  it("puts it back and says why when liking fails", async () => {
    likes.likeMedia.mockRejectedValue(new Error("No encontramos esa foto"));
    await openOn([item("a", { likeCount: 2 })], "a");
    await fireEvent.press(await heart());
    expect(await screen.findByText("No encontramos esa foto")).toBeVisible();
    expect(within(screen.getByRole("button", { name: "Me gusta" })).getByText("2")).toBeVisible();
  });

  it("double tap on the photo likes it, without hiding the overlay", async () => {
    await openOn([item("a", { likeCount: 0 })], "a");
    await heart();
    await fireEvent.press(screen.getByLabelText("Foto de Fede"));
    await fireEvent.press(screen.getByLabelText("Foto de Fede"));

    await waitFor(() => expect(likes.likeMedia).toHaveBeenCalledWith("a"));
    await waitFor(() => expect(within(screen.getByRole("button", { name: "Ya no me gusta" })).getByText("1")).toBeVisible());
    // The pending single tap was cancelled: the overlay is still there after the window.
    await act(async () => jest.advanceTimersByTime(300));
    expect(screen.getByRole("button", { name: "Ya no me gusta" })).toBeVisible();
  });

  it("double tap on a photo you already like never takes the like away", async () => {
    await openOn([item("a", { likeCount: 1, likedByMe: true })], "a");
    await screen.findByRole("button", { name: "Ya no me gusta" });
    await fireEvent.press(screen.getByLabelText("Foto de Fede"));
    await fireEvent.press(screen.getByLabelText("Foto de Fede"));
    await act(async () => jest.advanceTimersByTime(300));
    expect(likes.unlikeMedia).not.toHaveBeenCalled();
    expect(likes.likeMedia).not.toHaveBeenCalled();
  });

  it("videos have no heart", async () => {
    await openOn([item("v", { type: "video", durationS: 12 })], "v");
    await screen.findByRole("button", { name: "Guardar en Fotos" });
    expect(screen.queryByRole("button", { name: "Me gusta" })).toBeNull();
  });
});
