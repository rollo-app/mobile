import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as actions from "@/features/trips/actions";
import { saveSession } from "@/storage/trips";
import CreateScreen from "../app/create";
import HomeScreen from "../app/index";
import JoinScreen from "../app/join";
import TripScreen from "../app/trip/[id]";

jest.mock("@/features/trips/actions");
const mocked = jest.mocked(actions);

const routes = {
  index: HomeScreen,
  join: JoinScreen,
  create: CreateScreen,
  "trip/[id]": TripScreen,
};

const TRIP_ID = "11111111-1111-4111-8111-111111111111";
const trip = {
  id: TRIP_ID,
  name: "Viaje al sur",
  joinCode: "HUB5FT",
  timezone: "America/Argentina/Buenos_Aires",
  startsAt: 1,
  endsAt: 2,
  revealAt: 2,
  revealed: false,
  dailyPhotoLimit: 10,
  dailyVideoLimit: 3,
};

describe("Inicio", () => {
  it("sin viajes invita a crear uno o unirse", async () => {
    await renderRouter(routes, { initialUrl: "/" });

    expect(await screen.findByText("Todavía no estás en ningún viaje")).toBeVisible();
    expect(screen.getByRole("button", { name: "Crear un viaje" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Unirme con un código" })).toBeVisible();
  });

  it("lista los viajes guardados y abre uno", async () => {
    await saveSession({
      tripId: TRIP_ID,
      tripName: "Viaje al sur",
      joinCode: "HUB5FT",
      memberId: "m1",
      memberName: "Juani",
      role: "admin",
      token: "t",
    });
    mocked.fetchTrip.mockResolvedValue({
      trip,
      me: { id: "m1", name: "Juani", role: "admin" },
      members: [],
      today: { date: "2027-01-05", photosLeft: 10, videosLeft: 3 },
      totalUploaded: 0,
    });
    await renderRouter(routes, { initialUrl: "/" });

    await fireEvent.press(await screen.findByText("Viaje al sur"));

    await waitFor(() => expect(screen).toHavePathname(`/trip/${TRIP_ID}`));
  });

  it("los botones llevan a crear y unirse", async () => {
    await renderRouter(routes, { initialUrl: "/" });

    await fireEvent.press(await screen.findByRole("button", { name: "Unirme con un código" }));
    expect(screen).toHavePathname("/join");
  });
});

describe("Unirse", () => {
  it("el botón queda deshabilitado hasta tener código de 6 y nombre", async () => {
    await renderRouter(routes, { initialUrl: "/join" });
    const button = await screen.findByRole("button", { name: "Unirme" });

    expect(button).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText("Código del viaje"), "hub5f");
    await fireEvent.changeText(screen.getByLabelText("Tu nombre"), "Fede");
    expect(button).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText("Código del viaje"), "hub5ft");
    expect(button).toBeEnabled();
  });

  it("al unirse va al viaje", async () => {
    mocked.joinTrip.mockResolvedValue(trip);
    mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
    await renderRouter(routes, { initialUrl: "/join" });

    await fireEvent.changeText(await screen.findByLabelText("Código del viaje"), "hub5ft");
    await fireEvent.changeText(screen.getByLabelText("Tu nombre"), "Fede");
    await fireEvent.press(screen.getByRole("button", { name: "Unirme" }));

    await waitFor(() => expect(screen).toHavePathname(`/trip/${TRIP_ID}`));
    expect(mocked.joinTrip).toHaveBeenCalledWith({ code: "hub5ft", name: "Fede" });
  });

  it("muestra el error del server", async () => {
    mocked.joinTrip.mockRejectedValue(new Error("Código inválido"));
    await renderRouter(routes, { initialUrl: "/join" });

    await fireEvent.changeText(await screen.findByLabelText("Código del viaje"), "ZZZZZZ");
    await fireEvent.changeText(screen.getByLabelText("Tu nombre"), "Fede");
    await fireEvent.press(screen.getByRole("button", { name: "Unirme" }));

    expect(await screen.findByText("Código inválido")).toBeVisible();
    expect(screen).toHavePathname("/join");
  });
});

describe("Crear viaje", () => {
  it("pide nombre del viaje, tu nombre y días", async () => {
    await renderRouter(routes, { initialUrl: "/create" });
    const button = await screen.findByRole("button", { name: "Crear viaje" });

    expect(button).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText("Nombre del viaje"), "Viaje al sur");
    await fireEvent.changeText(screen.getByLabelText("Tu nombre"), "Juani");
    expect(button).toBeEnabled();

    await fireEvent.changeText(screen.getByLabelText("Días de viaje"), "0");
    expect(button).toBeDisabled();
  });

  it("crea el viaje con la zona horaria del celular y va al viaje", async () => {
    mocked.createTrip.mockResolvedValue(trip);
    mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
    await renderRouter(routes, { initialUrl: "/create" });

    await fireEvent.changeText(await screen.findByLabelText("Nombre del viaje"), "Viaje al sur");
    await fireEvent.changeText(screen.getByLabelText("Tu nombre"), "Juani");
    await fireEvent.changeText(screen.getByLabelText("Días de viaje"), "10");
    await fireEvent.press(screen.getByRole("button", { name: "Crear viaje" }));

    await waitFor(() => expect(screen).toHavePathname(`/trip/${TRIP_ID}`));
    expect(mocked.createTrip).toHaveBeenCalledWith({
      name: "Viaje al sur",
      adminName: "Juani",
      days: 10,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  });
});

describe("Viaje", () => {
  it("muestra el código para invitar, los miembros y lo que queda del rollo hoy", async () => {
    mocked.fetchTrip.mockResolvedValue({
      trip,
      me: { id: "m2", name: "Fede", role: "member" },
      members: [
        { id: "m1", name: "Juani", role: "admin" },
        { id: "m2", name: "Fede", role: "member" },
      ],
      today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
      totalUploaded: 12,
    });
    await renderRouter(routes, { initialUrl: `/trip/${TRIP_ID}` });

    expect(await screen.findByText("Viaje al sur")).toBeVisible();
    expect(screen.getByText("HUB5FT")).toBeVisible();
    expect(screen.getByText("Juani")).toBeVisible();
    expect(screen.getByText("Fede")).toBeVisible();
    expect(screen.getByText("Hoy te quedan 7 fotos y 2 videos")).toBeVisible();
    expect(screen.getByText("12 en el rollo")).toBeVisible();
    expect(mocked.fetchTrip).toHaveBeenCalledWith(TRIP_ID);
  });

  it("si falla la carga muestra el error", async () => {
    mocked.fetchTrip.mockRejectedValue(new Error("Sin conexión. Probá de nuevo cuando tengas señal."));
    await renderRouter(routes, { initialUrl: `/trip/${TRIP_ID}` });

    expect(await screen.findByText("Sin conexión. Probá de nuevo cuando tengas señal.")).toBeVisible();
  });
});
