import { router } from "expo-router";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { queryClient } from "@/api/query-client";
import * as actions from "@/features/trips/actions";
import { saveSession } from "@/storage/trips";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
const mocked = jest.mocked(actions);

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";

const detail = (): actions.TripDetail => ({
  trip: {
    id: SUR,
    name: "Viaje al sur",
    joinCode: "HUB5FT",
    timezone: "America/Argentina/Buenos_Aires",
    startsAt: Date.now() - 2 * DAY,
    endsAt: Date.now() + 9 * DAY,
    revealAt: Date.now() + 9 * DAY,
    revealed: false,
    dailyPhotoLimit: 10,
    dailyVideoLimit: 3,
  },
  me: { id: "m1", name: "Juani", role: "admin" },
  members: [
    { id: "m1", name: "Juani", role: "admin" },
    { id: "m2", name: "Fede", role: "member" },
  ],
  today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 12,
});

beforeEach(() => {
  mocked.fetchTrip.mockReset();
  return saveSession({ tripId: SUR, tripName: "Viaje al sur", joinCode: "HUB5FT", memberId: "m1", memberName: "Juani", role: "admin", token: "t" });
});

describe("Datos del viaje compartidos", () => {
  it("la barra de tabs y Rollo comparten un único pedido", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/rollo" });

    expect(await screen.findByText("7 de 10")).toBeVisible();
    expect(mocked.fetchTrip).toHaveBeenCalledTimes(1);
  });

  it("volver a una pantalla dentro de los 30 s no vuelve a pedirlo", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/rollo" });
    await screen.findByText("7 de 10");

    await act(async () => router.navigate("/vos"));
    expect(await screen.findByText("HUB5FT")).toBeVisible();
    await act(async () => router.navigate("/rollo"));
    expect(await screen.findByText("7 de 10")).toBeVisible();

    expect(mocked.fetchTrip).toHaveBeenCalledTimes(1);
  });

  it("pasados los 30 s, al ganar foco vuelve a pedirlo", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/rollo" });
    await screen.findByText("7 de 10");
    await act(async () => router.navigate("/vos"));
    await screen.findByText("HUB5FT");

    const key = ["trip", SUR];
    await act(async () => {
      queryClient.setQueryData(key, detail(), { updatedAt: Date.now() - 60_000 });
      router.navigate("/rollo");
    });

    await waitFor(() => expect(mocked.fetchTrip).toHaveBeenCalledTimes(2));
  });

  it("si falla y no hay cache muestra el error y Reintentar vuelve a pedirlo", async () => {
    mocked.fetchTrip.mockRejectedValueOnce(new Error("Sin conexión. Probá de nuevo cuando tengas señal."));
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/rollo" });

    expect(await screen.findByText("Sin conexión. Probá de nuevo cuando tengas señal.")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("7 de 10")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(mocked.fetchTrip).toHaveBeenCalledTimes(2);
  });

  it("Vos también ofrece Reintentar cuando no hay datos", async () => {
    mocked.fetchTrip.mockRejectedValueOnce(new Error("Sin conexión"));
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/vos" });

    await fireEvent.press(await screen.findByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("HUB5FT")).toBeVisible();
  });

  it("con datos guardados y sin señal muestra lo guardado, sin error", async () => {
    queryClient.setQueryData(["trip", SUR], detail(), { updatedAt: Date.now() - 60_000 });
    mocked.fetchTrip.mockRejectedValue(new Error("Sin conexión"));
    await renderRouter(routes, { initialUrl: "/rollo" });

    expect(await screen.findByText("7 de 10")).toBeVisible();
    await waitFor(() => expect(mocked.fetchTrip).toHaveBeenCalled());
    expect(screen.queryByText("Sin conexión")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(screen.getByText("7 de 10")).toBeVisible();
  });
});
