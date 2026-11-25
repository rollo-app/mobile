import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { CreateScreen } from "../create-screen";
import { createTrip, uploadCover } from "../actions";
import { offerPushAfterJoining } from "@/features/notifications/offer-push";
import { pickCoverPhoto } from "@/features/events/use-upload-cover";
import * as Burnt from "burnt";
import { ApiError } from "@/api/client";
import { useMe } from "@/features/auth/use-me";

jest.mock("expo-router", () => ({
  ...jest.requireActual("expo-router"),
  router: { back: jest.fn(), dismissTo: jest.fn(), push: jest.fn() },
}));
jest.mock("../actions", () => ({
  ...jest.requireActual("../actions"),
  createTrip: jest.fn(),
  uploadCover: jest.fn(),
}));
jest.mock("@/features/notifications/offer-push", () => ({
  offerPushAfterJoining: jest.fn(async () => undefined),
}));
jest.mock("@/features/events/use-upload-cover", () => ({
  pickCoverPhoto: jest.fn(),
}));
jest.mock("burnt", () => ({ alert: jest.fn() }));
jest.mock("@/features/auth/use-me", () => ({ useMe: jest.fn() }));
jest.mock("@/features/friends/actions", () => ({
  fetchFriends: jest.fn(async () => [{ id: "f1" }]),
}));

const createTripMock = jest.mocked(createTrip);
const uploadCoverMock = jest.mocked(uploadCover);
const pickCoverMock = jest.mocked(pickCoverPhoto);
const useMeMock = jest.mocked(useMe);
const offerMock = jest.mocked(offerPushAfterJoining);

async function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await render(
    <QueryClientProvider client={client}>
      <CreateScreen />
    </QueryClientProvider>,
  );
}

async function fillEvent() {
  await fireEvent.press(screen.getByRole("button", { name: "Evento" }));
  await fireEvent.changeText(screen.getByPlaceholderText("Nombre del evento"), "  Casamiento ");
  await fireEvent.changeText(screen.getByPlaceholderText("Nombre del grupo"), " Novios ");
}

function mockMe(canCreateEvents: boolean | undefined) {
  useMeMock.mockReturnValue({
    session: "in",
    token: "tok",
    me: canCreateEvents === undefined ? undefined : { canCreateEvents },
    failed: false,
    refetch: jest.fn(),
  } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMe(true);
  createTripMock.mockResolvedValue({ id: "t1" } as never);
});

describe("CreateScreen as an event", () => {
  it("the event form hides the moment section and fixes the quota to the whole rollo", async () => {
    await renderScreen();
    expect(screen.getByText("Momento del día")).toBeTruthy();
    expect(screen.queryByText("Grupos")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Evento" }));

    expect(screen.queryByText("Momento del día")).toBeNull();
    expect(screen.getByText("Grupos")).toBeTruthy();
    expect(screen.getByText("Portada")).toBeTruthy();
    expect(screen.getByText("20 fotos")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Todo el rollo" }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole("button", { name: "Todo el rollo" })).toBeTruthy();
  });

  it("blocks Crear until there is a name and a group, and lets you add and delete groups", async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Evento" }));
    await fireEvent.changeText(screen.getByPlaceholderText("Nombre del evento"), "Casamiento");
    expect(screen.getByRole("button", { name: "Crear" }).props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(screen.getByPlaceholderText("Nombre del grupo"), "Novios");
    expect(screen.getByRole("button", { name: "Crear" }).props.accessibilityState.disabled).toBe(false);

    await fireEvent.press(screen.getByRole("button", { name: "Agregar grupo" }));
    expect(screen.getAllByPlaceholderText("Nombre del grupo")).toHaveLength(2);
    await fireEvent.changeText(screen.getAllByPlaceholderText("Nombre del grupo")[1]!, "novios");
    expect(screen.getByRole("button", { name: "Crear" }).props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getAllByRole("button", { name: "Borrar" })[1]!);
    expect(screen.getAllByPlaceholderText("Nombre del grupo")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Crear" }).props.accessibilityState.disabled).toBe(false);
  });

  it("creating an event sends type, groups and total photo limit", async () => {
    await renderScreen();
    await fillEvent();
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(createTripMock).toHaveBeenCalledTimes(1));
    expect(createTripMock.mock.calls[0]![0]).toMatchObject({
      name: "  Casamiento ",
      type: "event",
      groups: ["Novios"],
      photoLimit: { mode: "total", total: 20 },
      momentMode: "off",
    });
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith("/roll"));
    expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/roll/[tripId]" }));
  });

  it("creating an event does not offer to add friends", async () => {
    await renderScreen();
    await fillEvent();
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(offerMock).toHaveBeenCalled());
    expect(offerMock).toHaveBeenCalledWith();
  });

  it("shows the chosen cover with the event's name, and removing it hides it", async () => {
    pickCoverMock.mockResolvedValue({ uri: "file:///cover.jpg", width: 1600, height: 1600 });
    await renderScreen();
    await fillEvent();
    expect(screen.queryByTestId("event-hero")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Elegir portada" }));

    expect(await screen.findByTestId("event-hero")).toBeVisible();
    expect(screen.getByRole("header", { name: "Casamiento" })).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Quitar portada" }));
    expect(screen.queryByTestId("event-hero")).toBeNull();
  });

  it("uploads the chosen cover after creating, and a failed upload does not block", async () => {
    const photo = { uri: "file:///cover.jpg", width: 4000, height: 3000 };
    pickCoverMock.mockResolvedValue(photo);
    uploadCoverMock.mockRejectedValue(new Error("offline"));
    await renderScreen();
    await fillEvent();
    await fireEvent.press(screen.getByRole("button", { name: "Elegir portada" }));
    await screen.findByRole("button", { name: "Cambiar portada" });
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(uploadCoverMock).toHaveBeenCalledWith("t1", photo));
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith("/roll"));
  });

  it("a regular rollo still sends no type or groups and offers adding friends", async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText("Nombre del rollo"), "Sur");
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(createTripMock).toHaveBeenCalledTimes(1));
    const input = createTripMock.mock.calls[0]![0];
    expect(input).not.toHaveProperty("type");
    expect(input).not.toHaveProperty("groups");
    await waitFor(() => expect(offerMock).toHaveBeenCalledWith("/add-friends"));
  });

  it("without canCreateEvents there is no Evento picker and creating sends a regular rollo", async () => {
    mockMe(false);
    await renderScreen();
    expect(screen.queryByRole("button", { name: "Evento" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rollo" })).toBeNull();

    await fireEvent.changeText(screen.getByPlaceholderText("Nombre del rollo"), "Sur");
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(createTripMock).toHaveBeenCalledTimes(1));
    const input = createTripMock.mock.calls[0]![0];
    expect(input).not.toHaveProperty("type");
    expect(input).not.toHaveProperty("groups");
  });

  it("while /me has not loaded the form is the regular one, without the picker", async () => {
    mockMe(undefined);
    await renderScreen();
    expect(screen.queryByRole("button", { name: "Evento" })).toBeNull();
    expect(screen.getByPlaceholderText("Nombre del rollo")).toBeTruthy();
  });

  it("with canCreateEvents the Evento picker shows", async () => {
    mockMe(true);
    await renderScreen();
    expect(screen.getByRole("button", { name: "Evento" })).toBeTruthy();
  });

  it("a 409 for an unrevealed event shows inline and keeps what was typed", async () => {
    const message = "Ya tenés un evento sin revelar. Vas a poder crear otro cuando se revele.";
    createTripMock.mockRejectedValue(new ApiError(409, message));
    await renderScreen();
    await fillEvent();
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    // Under the name and again at the end of the long form, where you are when you tap "Crear".
    expect(await screen.findAllByText(message)).toHaveLength(2);
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Nombre del evento")).toHaveDisplayValue("  Casamiento ");
    expect(screen.getByPlaceholderText("Nombre del grupo")).toHaveDisplayValue(" Novios ");
  });

  it("sends the description and the contest off by default", async () => {
    await renderScreen();
    await fillEvent();
    await fireEvent.changeText(screen.getByPlaceholderText("Descripción"), "  Nos casamos  ");
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(createTripMock).toHaveBeenCalledTimes(1));
    expect(createTripMock.mock.calls[0]![0]).toMatchObject({ description: "Nos casamos", contestEnabled: false });
    expect(createTripMock.mock.calls[0]![0]).not.toHaveProperty("contestVotingHours");
  });

  it("turning the contest on sends the voting hours and moves the reveal off Al terminar", async () => {
    await renderScreen();
    await fillEvent();
    expect(screen.getByRole("button", { name: "Al terminar" }).props.accessibilityState.selected).toBe(true);
    expect(screen.queryByLabelText("Votación de 3 días")).toBeNull();

    await fireEvent(screen.getByLabelText("Concurso de fotos"), "valueChange", true);

    expect(screen.getByLabelText("Votación de 3 días")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Otro momento" }).props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(createTripMock).toHaveBeenCalledTimes(1));
    const input = createTripMock.mock.calls[0]![0];
    expect(input).toMatchObject({ contestEnabled: true, contestVotingHours: 72 });
    expect(input.revealAt - input.endsAt).toBe(24 * 60 * 60 * 1000);
  });

  it("a regular rollo sends no description or contest", async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText("Nombre del rollo"), "Sur");
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));
    await waitFor(() => expect(createTripMock).toHaveBeenCalledTimes(1));
    expect(createTripMock.mock.calls[0]![0]).not.toHaveProperty("contestEnabled");
    expect(createTripMock.mock.calls[0]![0]).not.toHaveProperty("description");
  });

  it("creating a regular rollo sends its description", async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText("Nombre del rollo"), "Sur");
    await fireEvent.changeText(screen.getByPlaceholderText("Descripción"), "  Dos semanas  ");
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(createTripMock).toHaveBeenCalledTimes(1));
    expect(createTripMock.mock.calls[0]![0]).toMatchObject({ description: "Dos semanas" });
    expect(createTripMock.mock.calls[0]![0]).not.toHaveProperty("type");
  });

  it("creating a regular rollo with a cover uploads it after creating", async () => {
    const photo = { uri: "file:///cover.jpg", width: 4000, height: 3000 };
    pickCoverMock.mockResolvedValue(photo);
    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText("Nombre del rollo"), "Sur");
    await fireEvent.press(screen.getByRole("button", { name: "Elegir portada" }));
    expect(await screen.findByTestId("event-hero")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(uploadCoverMock).toHaveBeenCalledWith("t1", photo));
    await waitFor(() => expect(offerMock).toHaveBeenCalledWith("/add-friends"));
  });

  it("a failed cover upload keeps the new rollo and does not create it again", async () => {
    pickCoverMock.mockResolvedValue({ uri: "file:///cover.jpg", width: 4000, height: 3000 });
    uploadCoverMock.mockRejectedValue(new Error("offline"));
    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText("Nombre del rollo"), "Sur");
    await fireEvent.press(screen.getByRole("button", { name: "Elegir portada" }));
    await screen.findByRole("button", { name: "Cambiar portada" });
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(uploadCoverMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith("/roll"));
    expect(createTripMock).toHaveBeenCalledTimes(1);
    expect(Burnt.alert).toHaveBeenCalledWith({
      title: "No se pudo subir la portada",
      message: "Podés elegirla desde Ajustes del rollo.",
      preset: "error",
    });
  });
});
