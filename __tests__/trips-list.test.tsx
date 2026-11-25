import * as Burnt from "burnt";
import { Alert } from "react-native";
import { router } from "expo-router";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as friendsActions from "@/features/friends/actions";
import * as actions from "@/features/trips/actions";
import { queryClient } from "@/api/query-client";
import { localDay } from "@/features/capture/quota";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { getActiveTripId } from "@/storage/active-trip";
import type { TripSummary } from "@/features/trips/active";
import { signInAs, tripSummary, stubOwnProfile } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/friends/actions");
const trips = jest.mocked(actions);
const friends = jest.mocked(friendsActions);

const DAY = 24 * 60 * 60 * 1000;
const recent = Date.now() - 5 * DAY;
const revealedMine = tripSummary("t1", "Sur", { revealed: true, revealAt: recent, isCreator: false, role: "member" });
const revealedCreated = tripSummary("t2", "Tandil", { revealed: true, revealAt: recent - DAY, isCreator: true });
const unrevealed = tripSummary("t3", "Playa", { revealed: false, isCreator: false, role: "member", startsAt: Date.now() + DAY, revealAt: Date.now() + 3 * DAY, endsAt: Date.now() + 2 * DAY });
const live = tripSummary("t6", "Mar del Plata", { revealed: false, startsAt: Date.now() - DAY, endsAt: Date.now() + DAY, revealAt: Date.now() + DAY });
const SUR = "11111111-1111-4111-8111-111111111111";
const BARILOCHE = "33333333-3333-4333-8333-333333333333";
const OLD = "55555555-5555-4555-8555-555555555555";
const revealedAgo = (id: string, name: string, days: number) => {
  const now = Date.now();
  return tripSummary(id, name, { startsAt: now - (days + 8) * DAY, endsAt: now - (days + 1) * DAY, revealAt: now - days * DAY, revealed: true });
};
const archived1 = tripSummary("t4", "Viejo uno", { revealed: true, archived: true, revealAt: recent, isCreator: false, role: "member" });
const archived2 = tripSummary("t5", "Viejo dos", { revealed: true, archived: true, revealAt: recent - DAY, isCreator: false, role: "member" });

beforeEach(async () => {
  jest.clearAllMocks();
  trips.fetchTrip.mockReturnValue(new Promise(() => {}));
  trips.setTripArchived.mockResolvedValue(undefined);
  friends.leaveTrip.mockResolvedValue(undefined);
  await signInAs({ trips: [revealedMine, revealedCreated, unrevealed, archived1, archived2], active: "t1" });
});

async function signInWith(list: TripSummary[], active: string | null = null) {
  await signInAs({ trips: list, active: active ?? undefined });
}

const items = () => screen.queryAllByRole("menuitem").map((m) => m.props.accessibilityLabel as string);


// The Profile tab is always mounted and asks for GET /users/{id}: leave it pending (as develop does in other suites).
beforeEach(() => {
  stubOwnProfile();
});

describe("Rollos list", () => {
  it("the app opens on Rollos", async () => {
    await renderRouter(routes, { initialUrl: "/" });
    expect(await screen.findByRole("button", { name: "Sur, revelado" })).toBeVisible();
    expect(screen).toHavePathname("/roll");
    expect(screen.getByText("Próximos")).toBeVisible();
    expect(screen.getByText("Revelados")).toBeVisible();
  });

  it("a live roll shows its card with the photos left", async () => {
    await signInWith([live, revealedMine]);
    trips.fetchTrip.mockResolvedValue({
      trip: { id: "t6", photoLimitMode: "daily", timezone: "America/Argentina/Buenos_Aires", revealed: false, maxMembers: 15 },
      members: [],
      memberCount: 3,
      today: { date: localDay(Date.now(), "America/Argentina/Buenos_Aires"), photosLeft: 6, videosLeft: 0 },
    } as never);
    await renderRouter(routes, { initialUrl: "/roll" });
    expect(await screen.findByRole("button", { name: "Mar del Plata, en vivo" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sacar una foto en Mar del Plata" })).toBeVisible();
    expect(await screen.findByText("Te quedan 6 fotos hoy")).toBeVisible();
    expect(screen.queryByText("Próximos")).toBeNull();
  });

  it("without signal and without cache it says so with Reintentar, not the welcome, and retrying shows the list", async () => {
    queryClient.removeQueries({ queryKey: myTripsKey });
    trips.fetchMyTrips.mockRejectedValueOnce(new Error("Sin conexión"));
    trips.fetchMyTrips.mockResolvedValue({ trips: [revealedMine] });
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByText("Sin conexión")).toBeVisible();
    expect(screen.queryByText("Todavía no tenés rollos")).toBeNull();
    // Other tabs show the same failure with their own button: they share the one query.
    await fireEvent.press(screen.getAllByRole("button", { name: "Reintentar" })[0]!);

    expect(await screen.findByRole("button", { name: "Sur, revelado" })).toBeVisible();
    expect(trips.fetchMyTrips).toHaveBeenCalledTimes(2);
  });

  it("tapping a live card opens that roll", async () => {
    await signInWith([live, revealedMine]);
    await renderRouter(routes, { initialUrl: "/roll" });
    await fireEvent.press(await screen.findByRole("button", { name: "Mar del Plata, en vivo" }));
    await waitFor(() => expect(screen).toHavePathname("/roll/t6"));
  });

  it("the camera button makes that roll active and opens the camera", async () => {
    await signInWith([live, revealedMine], "t1");
    await renderRouter(routes, { initialUrl: "/roll" });
    await fireEvent.press(await screen.findByRole("button", { name: "Sacar una foto en Mar del Plata" }));
    await waitFor(() => expect(screen).toHavePathname("/capture"));
    expect(await getActiveTripId()).toBe("t6");
  });

  it("+ offers Nuevo rollo and Sumate con un código", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });
    await screen.findByRole("button", { name: "Sur, revelado" });
    expect(items()).toEqual(expect.arrayContaining(["Nuevo rollo", "Sumate con un código"]));
    await fireEvent.press(screen.getByRole("menuitem", { name: "Nuevo rollo" }));
    await waitFor(() => expect(screen).toHavePathname("/create"));
  });

  it("Sumate con un código goes to the join screen", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });
    await fireEvent.press(await screen.findByRole("menuitem", { name: "Sumate con un código" }));
    await waitFor(() => expect(screen).toHavePathname("/join"));
  });

  it("without rolls shows the welcome", async () => {
    await signInWith([]);
    await renderRouter(routes, { initialUrl: "/roll" });
    expect(await screen.findByText("Todavía no tenés rollos")).toBeVisible();
  });
});

describe("Rollos: archived and row actions", () => {
  it("shows 'Archivados · 2' collapsed at the end and opens it on tap", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });
    const header = await screen.findByRole("button", { name: "Archivados, 2" });
    expect(screen.getByText("Archivados · 2")).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Viejo uno/ })).toBeNull();
    await fireEvent.press(header);
    expect(await screen.findByRole("button", { name: /^Viejo uno/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Viejo dos/ })).toBeVisible();
  });

  it("offers Archivar and Eliminar on a revealed roll you didn't create", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });
    await screen.findByRole("button", { name: "Sur, revelado" });
    const sur = screen.getByRole("button", { name: "Sur, revelado" });
    expect(sur.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(["share", "archive", "leave"]);
    expect(items()).toContain("Compartir");
    expect(items()).toContain("Archivar");
    expect(items()).toContain("Eliminar");
  });

  it("has no Archivar on an unrevealed roll and no Eliminar on one you created", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });
    const playa = await screen.findByRole("button", { name: /^Playa/ });
    expect(playa.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(["share", "leave"]);
    const tandil = screen.getByRole("button", { name: /^Tandil/ });
    expect(tandil.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(["share", "archive"]);
  });

  it("offers Desarchivar on an archived roll", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });
    await fireEvent.press(await screen.findByRole("button", { name: "Archivados, 2" }));
    const row = await screen.findByRole("button", { name: /^Viejo uno/ });
    expect(row.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(["share", "unarchive", "leave"]);
    expect(items()).toContain("Desarchivar");
  });

  it.each([
    [/^Sur/, "t1", "collage"],
    [/^Playa/, "t3", "invite"],
  ])("Compartir on %s opens the share screen: the collage once revealed, the invitation before", async (name, tripId, kind) => {
    await renderRouter(routes, { initialUrl: "/roll" });
    const row = await screen.findByRole("button", { name });
    await fireEvent(row, "accessibilityAction", { nativeEvent: { actionName: "share" } });
    expect(screen).toHavePathname("/share-story");
    expect(screen).toHaveSearchParams({ tripId, kind });
  });

  it("Archivar calls setTripArchived and moves the row to Archivados without waiting, keeping the active roll", async () => {
    trips.setTripArchived.mockReturnValue(new Promise(() => {}));
    await renderRouter(routes, { initialUrl: "/roll" });
    await screen.findByRole("button", { name: /^Tandil/ });
    const tandil = screen.getByRole("button", { name: /^Tandil/ });
    await fireEvent(tandil, "accessibilityAction", { nativeEvent: { actionName: "archive" } });

    expect(trips.setTripArchived).toHaveBeenCalledWith("t2", true);
    expect(await screen.findByRole("button", { name: "Archivados, 3" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Tandil/ })).toBeNull();
    expect(screen).toHavePathname("/roll");
  });

  it("puts the roll back and alerts when archiving fails", async () => {
    trips.setTripArchived.mockRejectedValue(new Error("boom"));
    await renderRouter(routes, { initialUrl: "/roll" });
    await screen.findByRole("button", { name: /^Tandil/ });
    await fireEvent(screen.getByRole("button", { name: /^Tandil/ }), "accessibilityAction", { nativeEvent: { actionName: "archive" } });
    await waitFor(() => expect(Burnt.alert).toHaveBeenCalledWith(expect.objectContaining({ title: "No se pudo archivar" })));
    expect(await screen.findByRole("button", { name: /^Tandil/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Archivados, 2" })).toBeVisible();
  });

  it("Eliminar on a revealed roll warns that you can't come back, then leaves", async () => {
    const spy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderRouter(routes, { initialUrl: "/roll" });
    await screen.findByRole("button", { name: "Sur, revelado" });
    await fireEvent(screen.getByRole("button", { name: "Sur, revelado" }), "accessibilityAction", { nativeEvent: { actionName: "leave" } });
    expect(spy).toHaveBeenCalledWith(
      '¿Eliminar "Sur" de tus rollos?',
      "Salís del rollo y tus fotos se quedan para el grupo. No vas a poder volver a entrar.",
      expect.any(Array),
    );
    const buttons = spy.mock.calls[0]![2]!;
    expect(buttons.map((b) => b.text)).toEqual(["Cancelar", "Eliminar"]);
    buttons.find((b) => b.text === "Eliminar")!.onPress!();
    await waitFor(() => expect(friends.leaveTrip).toHaveBeenCalledWith("t1"));
    spy.mockRestore();
  });

  it("Eliminar on an unrevealed roll says you can come back with the code", async () => {
    const spy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderRouter(routes, { initialUrl: "/roll" });
    await screen.findByRole("button", { name: /^Playa/ });
    await fireEvent(screen.getByRole("button", { name: /^Playa/ }), "accessibilityAction", { nativeEvent: { actionName: "leave" } });
    expect(spy).toHaveBeenCalledWith(
      '¿Eliminar "Playa" de tus rollos?',
      "Salís del rollo y tus fotos se quedan para el grupo. Podés volver con el código.",
      expect.any(Array),
    );
    spy.mockRestore();
  });

  it("alerts natively and keeps the row when leaving from the list fails", async () => {
    friends.leaveTrip.mockRejectedValue(new Error("boom"));
    const spy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderRouter(routes, { initialUrl: "/roll" });
    await screen.findByRole("button", { name: "Sur, revelado" });
    await fireEvent(screen.getByRole("button", { name: "Sur, revelado" }), "accessibilityAction", { nativeEvent: { actionName: "leave" } });
    spy.mock.calls[0]![2]!.find((b) => b.text === "Eliminar")!.onPress!();
    await waitFor(() => expect(Burnt.alert).toHaveBeenCalledWith(expect.objectContaining({ preset: "error" })));
    expect(screen.getByRole("button", { name: "Sur, revelado" })).toBeVisible();
    spy.mockRestore();
  });
});

describe("Rollos: row states and grouping", () => {
  it("shows each roll's state: LIVE, Revelado, or when it starts", async () => {
    trips.fetchTrip.mockReturnValue(new Promise(() => {}));
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    await signInAs({
      trips: [
        tripSummary(SUR, "Sur (prueba)", { startsAt: now - day, endsAt: now + day, revealAt: now + day, coverThumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI" }),
        tripSummary(BARILOCHE, "Bariloche", { startsAt: now - 9 * day, endsAt: now - 2 * day, revealAt: now - day, revealed: true }),
        tripSummary("44444444-4444-4444-8444-444444444444", "Tandil", { startsAt: now + 10 * day, endsAt: now + 12 * day, revealAt: now + 12 * day }),
      ],
      active: SUR,
    });
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByRole("button", { name: "Sur (prueba), en vivo" })).toBeVisible();
    expect(screen.getByText("LIVE")).toBeVisible();
    expect(screen.getByRole("button", { name: "Bariloche, revelado" })).toBeVisible();
    expect(screen.getByText("Revelado")).toBeVisible();
    expect(screen.getByRole("button", { name: "Tandil" })).toBeVisible();
    expect(screen.getByText(/^Empieza en \d+ días$/)).toBeVisible();
    expect(screen.getAllByText(/^(LIVE|Revelado)$/)).toHaveLength(2);
  });

  describe("grouping", () => {

    it("shows recent revealed rolls under 'Revelados' and keeps the old ones collapsed", async () => {
      trips.fetchTrip.mockReturnValue(new Promise(() => {}));
      await signInAs({ trips: [revealedAgo(BARILOCHE, "Bariloche", 10), revealedAgo(OLD, "Mendoza", 200)], active: BARILOCHE });
      await renderRouter(routes, { initialUrl: "/roll" });

      expect(await screen.findByText("Revelados")).toBeVisible();
      expect(screen.getByRole("button", { name: "Bariloche, revelado" })).toBeVisible();
      expect(screen.getByText("Anteriores · 1")).toBeVisible();
      expect(screen.getByRole("button", { name: "Anteriores, 1" }).props.accessibilityState).toMatchObject({ expanded: false });
      expect(screen.queryByRole("button", { name: "Mendoza, revelado" })).toBeNull();
    });

    it("expands the old rolls inline when you tap 'Anteriores' and collapses them again", async () => {
      trips.fetchTrip.mockReturnValue(new Promise(() => {}));
      await signInAs({ trips: [revealedAgo(BARILOCHE, "Bariloche", 10), revealedAgo(OLD, "Mendoza", 200)], active: BARILOCHE });
      await renderRouter(routes, { initialUrl: "/roll" });

      await fireEvent.press(await screen.findByRole("button", { name: "Anteriores, 1" }));
      expect(screen.getByRole("button", { name: "Mendoza, revelado" })).toBeVisible();

      await fireEvent.press(screen.getByRole("button", { name: "Anteriores, 1" }));
      expect(screen.queryByRole("button", { name: "Mendoza, revelado" })).toBeNull();
    });

    it("starts expanded when the active roll is an old one", async () => {
      trips.fetchTrip.mockReturnValue(new Promise(() => {}));
      await signInAs({ trips: [revealedAgo(BARILOCHE, "Bariloche", 10), revealedAgo(OLD, "Mendoza", 200)], active: OLD });
      await renderRouter(routes, { initialUrl: "/roll" });

      expect(await screen.findByRole("button", { name: "Mendoza, revelado" })).toBeVisible();
    });

    it("has no 'Anteriores' row without old rolls", async () => {
      trips.fetchTrip.mockReturnValue(new Promise(() => {}));
      await signInAs({ trips: [revealedAgo(BARILOCHE, "Bariloche", 10)], active: BARILOCHE });
      await renderRouter(routes, { initialUrl: "/roll" });

      await screen.findByText("Revelados");
      expect(screen.queryByText(/^Anteriores/)).toBeNull();
    });
  });
});

// Opening a roll mounts its screen, which keeps loading (detail, active id) after the test body; each test waits for
// that to finish so it doesn't spill into the next one.
describe("Rollos: opening a roll", () => {
  const rollLoaded = () => waitFor(() => expect(trips.fetchTrip).toHaveBeenCalled());
  it("tapping a row opens that roll with Rollos to go back", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });
    await fireEvent.press(await screen.findByRole("button", { name: /^Tandil/ }));
    await waitFor(() => expect(screen).toHavePathname("/roll/t2"));
    // Pushed on top of the list (not replacing it), and the roll marks itself active once mounted.
    await waitFor(async () => expect(await getActiveTripId()).toBe("t2"));
    expect(router.canGoBack()).toBe(true);
    await rollLoaded();
    await act(async () => {});
  });

  it("choosing an old roll makes it the active one", async () => {
    trips.fetchTrip.mockReturnValue(new Promise(() => {}));
    await signInAs({ trips: [revealedAgo(BARILOCHE, "Bariloche", 10), revealedAgo(OLD, "Mendoza", 200)], active: BARILOCHE });
    await renderRouter(routes, { initialUrl: "/roll" });

    await fireEvent.press(await screen.findByRole("button", { name: "Anteriores, 1" }));
    await fireEvent.press(screen.getByRole("button", { name: "Mendoza, revelado" }));

    await waitFor(() => expect(screen).toHavePathname(`/roll/${OLD}`));
    await waitFor(async () => expect(await getActiveTripId()).toBe(OLD));
    await rollLoaded();
    await act(async () => {});
  });
});
