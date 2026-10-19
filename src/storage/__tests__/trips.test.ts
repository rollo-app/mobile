import * as SecureStore from "expo-secure-store";
import { getToken, listTrips, markOpened, removeTrip, saveSession, type TripSession } from "../trips";

const session = (overrides: Partial<TripSession> = {}): TripSession => ({
  tripId: "11111111-1111-4111-8111-111111111111",
  tripName: "Viaje al sur",
  joinCode: "HUB5FT",
  memberId: "22222222-2222-4222-8222-222222222222",
  memberName: "Juani",
  role: "admin",
  token: "secret-token",
  ...overrides,
});

describe("sesiones de viaje", () => {
  it("guarda el viaje y su token", async () => {
    await saveSession(session());

    expect(await listTrips()).toEqual([
      expect.objectContaining({ tripId: session().tripId, tripName: "Viaje al sur", memberName: "Juani", role: "admin" }),
    ]);
    expect(await getToken(session().tripId)).toBe("secret-token");
  });

  it("nunca guarda el token en la lista de viajes", async () => {
    await saveSession(session());

    const [trip] = await listTrips();
    expect(trip).not.toHaveProperty("token");

    const stored = [...(SecureStore as any).__store.entries()];
    const indexEntry = stored.find(([key]: [string]) => key === "rollo.trips");
    expect(indexEntry[1]).not.toContain("secret-token");
  });

  it("muestra primero el último viaje al que entraste", async () => {
    await saveSession(session({ tripId: "a", tripName: "Primero" }));
    await saveSession(session({ tripId: "b", tripName: "Segundo" }));

    expect((await listTrips()).map((t) => t.tripName)).toEqual(["Segundo", "Primero"]);
  });

  it("volver a guardar el mismo viaje lo actualiza sin duplicarlo", async () => {
    await saveSession(session({ tripName: "Viejo nombre" }));
    await saveSession(session({ tripName: "Nuevo nombre", token: "otro-token" }));

    const trips = await listTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0]!.tripName).toBe("Nuevo nombre");
    expect(await getToken(session().tripId)).toBe("otro-token");
  });

  it("sacar un viaje borra también su token", async () => {
    await saveSession(session());
    await removeTrip(session().tripId);

    expect(await listTrips()).toEqual([]);
    expect(await getToken(session().tripId)).toBeNull();
  });

  it("sin viajes guardados devuelve una lista vacía", async () => {
    expect(await listTrips()).toEqual([]);
  });

  it("abrir un viaje lo pone primero sin tocar su token", async () => {
    await saveSession(session({ tripId: "a", tripName: "Primero", token: "token-a" }));
    await saveSession(session({ tripId: "b", tripName: "Segundo" }));

    await markOpened("a");

    expect((await listTrips()).map((t) => t.tripName)).toEqual(["Primero", "Segundo"]);
    expect(await getToken("a")).toBe("token-a");
  });

  it("abrir un viaje que no está guardado no hace nada", async () => {
    await saveSession(session({ tripId: "a", tripName: "Primero" }));

    await markOpened("otro");

    expect((await listTrips()).map((t) => t.tripId)).toEqual(["a"]);
  });
});
