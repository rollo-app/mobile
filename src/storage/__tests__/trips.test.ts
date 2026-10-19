import * as SecureStore from "expo-secure-store";
import { getToken, listTrips, markOpened, removeTrip, saveSession, updateMemberName, type TripSession } from "../trips";

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

describe("trip sessions", () => {
  it("saves the trip and its token", async () => {
    await saveSession(session());

    expect(await listTrips()).toEqual([
      expect.objectContaining({ tripId: session().tripId, tripName: "Viaje al sur", memberName: "Juani", role: "admin" }),
    ]);
    expect(await getToken(session().tripId)).toBe("secret-token");
  });

  it("never stores the token in the trip list", async () => {
    await saveSession(session());

    const [trip] = await listTrips();
    expect(trip).not.toHaveProperty("token");

    const stored = [...(SecureStore as any).__store.entries()];
    const indexEntry = stored.find(([key]: [string]) => key === "rollo.trips");
    expect(indexEntry[1]).not.toContain("secret-token");
  });

  it("shows the last trip you entered first", async () => {
    await saveSession(session({ tripId: "a", tripName: "Primero" }));
    await saveSession(session({ tripId: "b", tripName: "Segundo" }));

    expect((await listTrips()).map((t) => t.tripName)).toEqual(["Segundo", "Primero"]);
  });

  it("saving the same trip again updates it without duplicating it", async () => {
    await saveSession(session({ tripName: "Viejo nombre" }));
    await saveSession(session({ tripName: "Nuevo nombre", token: "otro-token" }));

    const trips = await listTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0]!.tripName).toBe("Nuevo nombre");
    expect(await getToken(session().tripId)).toBe("otro-token");
  });

  it("removing a trip also deletes its token", async () => {
    await saveSession(session());
    await removeTrip(session().tripId);

    expect(await listTrips()).toEqual([]);
    expect(await getToken(session().tripId)).toBeNull();
  });

  it("with no saved trips returns an empty list", async () => {
    expect(await listTrips()).toEqual([]);
  });

  it("opening a trip puts it first without touching its token", async () => {
    await saveSession(session({ tripId: "a", tripName: "Primero", token: "token-a" }));
    await saveSession(session({ tripId: "b", tripName: "Segundo" }));

    await markOpened("a");

    expect((await listTrips()).map((t) => t.tripName)).toEqual(["Primero", "Segundo"]);
    expect(await getToken("a")).toBe("token-a");
  });

  it("opening a trip that is not saved does nothing", async () => {
    await saveSession(session({ tripId: "a", tripName: "Primero" }));

    await markOpened("otro");

    expect((await listTrips()).map((t) => t.tripId)).toEqual(["a"]);
  });
});

describe("updateMemberName", () => {
  it("changes the name on the trip without touching the token or the order", async () => {
    await saveSession(session());
    await saveSession(session({ tripId: "otro", tripName: "Bariloche" }));

    await updateMemberName(session().tripId, "Juan");

    const trips = await listTrips();
    expect(trips.map((t) => t.tripId)).toEqual(["otro", session().tripId]);
    expect(trips[1]!.memberName).toBe("Juan");
    expect(trips[0]!.memberName).toBe("Juani");
    expect(await getToken(session().tripId)).toBe("secret-token");
  });

  it("if the trip does not exist it does nothing", async () => {
    await updateMemberName("nada", "Juan");

    expect(await listTrips()).toEqual([]);
  });
});
