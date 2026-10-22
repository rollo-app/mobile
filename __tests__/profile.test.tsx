import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import * as friendActions from "@/features/friends/actions";
import * as profileActions from "@/features/profile/actions";
import * as actions from "@/features/trips/actions";
import { signInAs, tripSummary, USER } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/friends/actions");

const SUR = "11111111-1111-4111-8111-111111111111";
const BIO = "Viajando por el sur";

beforeEach(() => {
  jest.mocked(friendActions).fetchFriends.mockResolvedValue([]);
  jest.mocked(actions).fetchMyTrips.mockResolvedValue({ trips: [tripSummary(SUR, "Viaje al sur")] });
  jest.mocked(actions).fetchTrip.mockReturnValue(new Promise(() => {}));
  jest.mocked(actions).fetchFeed.mockReturnValue(new Promise(() => {}));
});

afterEach(() => jest.restoreAllMocks());

describe("Perfil", () => {
  it("shows your photo, name, handle and description, and no account settings", async () => {
    await signInAs({ user: { ...USER, bio: BIO }, trips: [tripSummary(SUR, "Viaje al sur")] });
    await renderRouter(routes, { initialUrl: "/me" });

    expect(await screen.findByText(BIO)).toBeVisible();
    expect(screen.getByText("@juani")).toBeVisible();
    expect(screen.getAllByText("Juani").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("avatar", { includeHiddenElements: true }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Borrar cuenta" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar perfil" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Mapa sin señal/ })).toBeNull();
  });

  it("without a description there is no empty text under the handle", async () => {
    await signInAs({ user: { ...USER, bio: null }, trips: [tripSummary(SUR, "Viaje al sur")] });
    await renderRouter(routes, { initialUrl: "/me" });

    await screen.findByText("@juani");
    expect(screen.queryByTestId("profile-bio")).toBeNull();
  });

  it("the gear opens Ajustes with Editar perfil, Mapa sin señal, Cerrar sesión and Borrar cuenta", async () => {
    await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
    await renderRouter(routes, { initialUrl: "/me" });

    await fireEvent.press(await screen.findByRole("button", { name: "Ajustes" }));

    expect(screen).toHavePathname("/settings");
    expect(await screen.findByRole("button", { name: "Editar perfil" })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Mapa sin señal/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Borrar cuenta" })).toBeVisible();
  });

  it("the segmented control switches between the empty Fotos and Mapa states", async () => {
    await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
    await renderRouter(routes, { initialUrl: "/me" });

    const photos = "Cuando se revele un rollo, vas a poder elegir tus mejores fotos para mostrar acá.";
    const places = "Acá vas a ver las zonas donde sacaste tus fotos destacadas.";
    expect(await screen.findByText(photos)).toBeVisible();
    expect(screen.queryByText(places)).toBeNull();

    const showcase = within(screen.getByTestId("profile-showcase"));
    await fireEvent.press(showcase.getByRole("button", { name: "Mapa" }));
    expect(screen.getByText(places)).toBeVisible();
    expect(screen.queryByText(photos)).toBeNull();

    await fireEvent.press(showcase.getByRole("button", { name: "Fotos" }));
    expect(screen.getByText(photos)).toBeVisible();
  });
});

describe("Editar perfil: descripción", () => {
  beforeEach(() => signInAs({ user: { ...USER, bio: "Hola" }, trips: [tripSummary(SUR, "Viaje al sur")] }));

  it("is prefilled, counts characters and saves the description with PATCH /me", async () => {
    const update = jest.spyOn(profileActions, "updateProfile").mockResolvedValue({ ...USER, bio: BIO });
    await renderRouter(routes, { initialUrl: "/settings" });
    await fireEvent.press(await screen.findByRole("button", { name: "Editar perfil" }));

    const input = await screen.findByLabelText("Descripción");
    expect(input.props.value).toBe("Hola");
    expect(input.props.maxLength).toBe(150);
    expect(input.props.multiline).toBe(true);
    expect(screen.getByText("4/150")).toBeVisible();

    await fireEvent.changeText(input, BIO);
    expect(screen.getByText(`${BIO.length}/150`)).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen).toHavePathname("/settings"));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ bio: BIO }));
  });

  it("shows the server's error inline and keeps the text", async () => {
    jest.spyOn(profileActions, "updateProfile").mockRejectedValue(new Error("La descripción puede tener hasta 3 renglones"));
    await renderRouter(routes, { initialUrl: "/edit-profile" });

    const input = await screen.findByLabelText("Descripción");
    await fireEvent.changeText(input, "uno\ndos\ntres\ncuatro");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("La descripción puede tener hasta 3 renglones")).toBeVisible();
    expect(screen.getByLabelText("Descripción").props.value).toBe("uno\ndos\ntres\ncuatro");
    expect(screen).toHavePathname("/edit-profile");
  });

  it("is not part of Completá tu perfil", async () => {
    await signInAs({ user: { ...USER, name: null } });
    await renderRouter(routes, { initialUrl: "/" });

    expect(await screen.findByText("Completá tu perfil")).toBeVisible();
    expect(screen.queryByLabelText("Descripción")).toBeNull();
  });
});
