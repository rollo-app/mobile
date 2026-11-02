import { Alert } from "react-native";
import { router } from "expo-router";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import "@/test/reanimated";
import * as friendActions from "@/features/friends/actions";
import * as tripActions from "@/features/trips/actions";
import * as momentCancel from "@/features/moments/cancel";
import { getActiveTripId, setActiveTripId } from "@/storage/active-trip";
import { queryClient } from "@/api/query-client";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { markPresentationSeen } from "@/storage/presentation";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/friends/actions");
jest.mock("@/features/trips/actions");
jest.mock("@/features/moments/cancel", () => ({ ...jest.requireActual("@/features/moments/cancel"), cancelMomentNotifications: jest.fn(async () => {}) }));
const friends = jest.mocked(friendActions);
const trips = jest.mocked(tripActions);

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";

type Member = tripActions.TripDetail["me"];
const member = (over: Partial<Member> & Pick<Member, "id" | "userId" | "name">): Member => ({
  username: over.name.toLowerCase(),
  avatarUrl: null,
  role: "member",
  isCreator: false,
  blockedByMe: false,
  ...over,
});

const creator = member({ id: "m1", userId: "u1", name: "Juani", role: "admin", isCreator: true });
const adminCami = member({ id: "m2", userId: "u2", name: "Cami", role: "admin" });
const fede = member({ id: "m5", userId: "u5", name: "Fede" });
const tomi = member({ id: "m6", userId: "u6", name: "Tomi" });

const detail = (me: Member, over: Partial<tripActions.Trip> = {}): tripActions.TripDetail => ({
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
    featuringDisabled: false,
    photoLimitMode: "daily",
    totalPhotoLimit: null,
    momentMode: "off",
    momentWindowStart: 540,
    momentWindowEnd: 1380,
    createdBy: { userId: "u1", name: "Juani" },
    ...over,
  },
  me,
  members: [creator, adminCami, fede, tomi].map((m) => (m.id === me.id ? me : m)),
  today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 3,
});

let alert: jest.SpyInstance;
let prompt: jest.SpyInstance;

async function openBoard(d: tripActions.TripDetail) {
  trips.fetchTrip.mockResolvedValue(d);
  await setActiveTripId(SUR);
  await renderRouter(routes, { initialUrl: "/roll" });
  await screen.findByText(/^En el rollo · /);
}

const items = () => screen.queryAllByRole("menuitem").map((m) => m.props.accessibilityLabel as string);
const alertButtons = () => alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
const names = (el: { props: { accessibilityActions?: { name: string }[] } }) => el.props.accessibilityActions?.map((a) => a.name);
const act1 = (el: Parameters<typeof fireEvent>[0], actionName: string) =>
  fireEvent(el, "accessibilityAction", { nativeEvent: { actionName } });
const savePrompt = () => (prompt.mock.calls[0]![2] as { text: string; onPress?: (t: string) => void }[]).find((b) => b.text === "Guardar")!;

beforeEach(async () => {
  for (const mock of [...Object.values(friends), ...Object.values(trips)]) (mock as Partial<jest.Mock>).mockReset?.();
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
  trips.fetchMyTrips.mockResolvedValue({ trips: [tripSummary(SUR, "Viaje al sur")] });
  trips.fetchFeed.mockResolvedValue({ revealed: false, revealAt: Date.now() + DAY, items: [] });
  friends.fetchFriends.mockResolvedValue([]);
  friends.fetchFriendRequests.mockResolvedValue([]);
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  prompt = jest.spyOn(Alert, "prompt").mockImplementation(() => {});
});
afterEach(() => {
  alert.mockRestore();
  prompt.mockRestore();
});

describe("Members list: badges and actions", () => {
  it("shows Creador on the creator's row and Admin on an admin's", async () => {
    await openBoard(detail(tomi));
    expect(screen.getByRole("button", { name: "Cami, Admin" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Fede" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Juani, Creador" })).toBeVisible();
  });

  it("lets Bloqueado win over the role badge", async () => {
    const blocked = { ...adminCami, blockedByMe: true };
    trips.fetchTrip.mockResolvedValue({ ...detail(tomi), members: [creator, blocked, fede, tomi] });
    await setActiveTripId(SUR);
    await renderRouter(routes, { initialUrl: "/roll" });
    expect(await screen.findByRole("button", { name: "Cami, Bloqueado" })).toBeVisible();
  });

  it("offers Hacer admin and Sacar del rollo on a plain member when you are an admin", async () => {
    await openBoard(detail(adminCami));
    expect(names(screen.getByRole("button", { name: "Fede" }))).toEqual(["makeAdmin", "remove"]);
    expect(items()).toContain("Hacer admin");
    expect(items()).toContain("Sacar del rollo");
    // The creator can't be touched.
    expect(names(screen.getByRole("button", { name: "Juani, Creador" }))).toBeUndefined();
  });

  it("offers nothing to a plain member", async () => {
    await openBoard(detail(tomi));
    expect(items()).not.toContain("Hacer admin");
    expect(items()).not.toContain("Sacar del rollo");
    expect(names(screen.getByRole("button", { name: "Fede" }))).toBeUndefined();
  });

  it("Hacer admin calls makeAdmin", async () => {
    trips.makeAdmin.mockResolvedValue(fede);
    await openBoard(detail(adminCami));
    await act1(screen.getByRole("button", { name: "Fede" }), "makeAdmin");
    await waitFor(() => expect(trips.makeAdmin).toHaveBeenCalledWith(SUR, "m5"));
  });

  it("only the creator can take admin away from an admin", async () => {
    await openBoard(detail(creator));
    const cami = screen.getByRole("button", { name: "Cami, Admin" });
    expect(names(cami)).toEqual(["removeAdmin", "remove"]);
    expect(items()).toContain("Quitar admin");
    trips.removeAdmin.mockResolvedValue(adminCami);
    await act1(cami, "removeAdmin");
    await waitFor(() => expect(trips.removeAdmin).toHaveBeenCalledWith(SUR, "m2"));
  });

  it("Sacar del rollo asks first, then removes the member", async () => {
    trips.removeMember.mockResolvedValue(undefined);
    await openBoard(detail(adminCami));
    await act1(screen.getByRole("button", { name: "Fede" }), "remove");
    expect(alert).toHaveBeenCalledWith("¿Sacar a Fede del rollo?", "Sus fotos se quedan. Solo un admin lo puede volver a sumar.", expect.any(Array));
    expect(alertButtons().map((b) => b.text)).toEqual(["Cancelar", "Sacar"]);
    expect(trips.removeMember).not.toHaveBeenCalled();
    await act(async () => alertButtons().find((b) => b.text === "Sacar")!.onPress!());
    await waitFor(() => expect(trips.removeMember).toHaveBeenCalledWith(SUR, "m5"));
  });

  it("the menu item triggers the same action", async () => {
    await openBoard(detail(adminCami));
    await fireEvent.press(screen.getAllByRole("menuitem", { name: "Sacar del rollo" })[0]!);
    expect(alert).toHaveBeenCalledWith("¿Sacar a Fede del rollo?", expect.any(String), expect.any(Array));
  });

  it("tapping a member row still opens their profile", async () => {
    await openBoard(detail(adminCami));
    await fireEvent.press(screen.getByRole("button", { name: "Fede" }));
    await waitFor(() => expect(screen).toHavePathname("/user/u5"));
  });

  it("shows the failure under the members section and keeps the list", async () => {
    trips.makeAdmin.mockRejectedValue(new Error("Solo quien creó el rollo puede hacer esto"));
    await openBoard(detail(adminCami));
    await act1(screen.getByRole("button", { name: "Fede" }), "makeAdmin");
    expect(await screen.findByText("Solo quien creó el rollo puede hacer esto")).toBeVisible();
    expect(screen.getByRole("button", { name: "Fede" })).toBeVisible();
  });

  it("refetches the detail after a change", async () => {
    trips.makeAdmin.mockResolvedValue(fede);
    await openBoard(detail(adminCami));
    const before = trips.fetchTrip.mock.calls.length;
    await act1(screen.getByRole("button", { name: "Fede" }), "makeAdmin");
    await waitFor(() => expect(trips.fetchTrip.mock.calls.length).toBeGreaterThan(before));
  });
});

describe("Leaving as creator", () => {
  it("hides Salirme del rollo for the creator", async () => {
    await openBoard(detail(creator));
    expect(screen.queryByRole("button", { name: "Salirme del rollo" })).toBeNull();
  });

  it("keeps it for an admin who is not the creator", async () => {
    await openBoard(detail(adminCami));
    expect(screen.getByRole("button", { name: "Salirme del rollo" })).toBeVisible();
  });
});

describe("Creado por", () => {
  it("shows who created the rollo in the Fechas footer", async () => {
    await openBoard(detail(tomi));
    expect(screen.getByText("Creado por Juani")).toBeVisible();
  });

  it("shows nothing without createdBy", async () => {
    await openBoard(detail(tomi, { createdBy: null }));
    expect(screen.queryByText(/Creado por/)).toBeNull();
  });
});

describe("Renaming", () => {
  it("shows the Nombre row to admins only", async () => {
    await openBoard(detail(tomi));
    expect(screen.queryByRole("button", { name: /^Nombre/ })).toBeNull();
  });

  it("prompts with the current name and saves the trimmed new one", async () => {
    trips.renameTrip.mockResolvedValue({} as tripActions.Trip);
    await openBoard(detail(adminCami));
    await fireEvent.press(screen.getByRole("button", { name: "Nombre, Viaje al sur" }));
    expect(prompt).toHaveBeenCalledWith("Nombre del rollo", undefined, expect.any(Array), "plain-text", "Viaje al sur");
    await act(async () => savePrompt().onPress!("  Patagonia  "));
    await waitFor(() => expect(trips.renameTrip).toHaveBeenCalledWith(SUR, "Patagonia"));
  });

  it("sends nothing when the name is empty or unchanged", async () => {
    await openBoard(detail(adminCami));
    await fireEvent.press(screen.getByRole("button", { name: "Nombre, Viaje al sur" }));
    await act(async () => savePrompt().onPress!("   "));
    await act(async () => savePrompt().onPress!("Viaje al sur "));
    expect(trips.renameTrip).not.toHaveBeenCalled();
  });

  it("rejects a name over 60 characters with a message and sends nothing", async () => {
    await openBoard(detail(adminCami));
    await fireEvent.press(screen.getByRole("button", { name: "Nombre, Viaje al sur" }));
    await act(async () => savePrompt().onPress!("x".repeat(61)));
    expect(await screen.findByText("El nombre puede tener hasta 60 caracteres")).toBeVisible();
    expect(trips.renameTrip).not.toHaveBeenCalled();
  });

  it("only shows the latest action's error", async () => {
    trips.makeAdmin.mockRejectedValue(new Error("Falló hacer admin"));
    trips.renameTrip.mockRejectedValue(new Error("Falló renombrar"));
    await openBoard(detail(adminCami));
    await act1(screen.getByRole("button", { name: "Fede" }), "makeAdmin");
    expect(await screen.findByText("Falló hacer admin")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Nombre, Viaje al sur" }));
    await act(async () => savePrompt().onPress!("Otro"));
    expect(await screen.findByText("Falló renombrar")).toBeVisible();
    expect(screen.queryByText("Falló hacer admin")).toBeNull();
  });

  it("shows the failure under the members section", async () => {
    trips.renameTrip.mockRejectedValue(new Error("No se pudo"));
    await openBoard(detail(adminCami));
    await fireEvent.press(screen.getByRole("button", { name: "Nombre, Viaje al sur" }));
    await act(async () => savePrompt().onPress!("Otro"));
    expect(await screen.findByText("No se pudo")).toBeVisible();
  });
});

describe("Archiving from the rollo", () => {
  const revealedDetail = (me: Member) => detail(me, { revealed: true, revealAt: Date.now() - DAY });
  const openRevealed = async (d: tripActions.TripDetail, archived: boolean) => {
    const list = { trips: [tripSummary(SUR, "Viaje al sur", { revealed: true, archived })] };
    trips.fetchMyTrips.mockResolvedValue(list);
    queryClient.setQueryData(myTripsKey, list);
    trips.fetchTrip.mockResolvedValue(d);
    trips.fetchFeed.mockResolvedValue({ revealed: true, revealAt: Date.now() - DAY, items: [] });
    await setActiveTripId(SUR);
    await markPresentationSeen(SUR);
    await renderRouter(routes, { initialUrl: "/roll?view=roll" });
    await screen.findByText(/^En el rollo · /);
  };

  it("offers Archivar rollo on a revealed rollo and archives it", async () => {
    trips.setTripArchived.mockResolvedValue(undefined);
    await openRevealed(revealedDetail(tomi), false);
    await fireEvent.press(await screen.findByRole("button", { name: "Archivar rollo" }));
    await waitFor(() => expect(trips.setTripArchived).toHaveBeenCalledWith(SUR, true));
  });

  it("offers Desarchivar rollo when it is archived", async () => {
    trips.setTripArchived.mockResolvedValue(undefined);
    await openRevealed(revealedDetail(tomi), true);
    await fireEvent.press(await screen.findByRole("button", { name: "Desarchivar rollo" }));
    await waitFor(() => expect(trips.setTripArchived).toHaveBeenCalledWith(SUR, false));
  });

  it("does not offer archiving before the reveal", async () => {
    await openBoard(detail(tomi));
    expect(screen.queryByRole("button", { name: /archivar rollo/i })).toBeNull();
  });
});

describe("Borrar rollo (creator)", () => {
  let dismissTo: jest.SpyInstance;
  // The router is only live once rendered, so the spy goes on after `openBoard`.
  const open = async (d: tripActions.TripDetail) => {
    await openBoard(d);
    dismissTo = jest.spyOn(router, "dismissTo").mockImplementation(() => {});
  };
  afterEach(() => dismissTo?.mockRestore());

  it("is hidden for an admin who is not the creator", async () => {
    await openBoard(detail(adminCami));
    expect(screen.queryByRole("button", { name: "Borrar rollo" })).toBeNull();
  });

  it("asks first and does nothing on Cancelar", async () => {
    await openBoard(detail(creator));
    await fireEvent.press(screen.getByRole("button", { name: "Borrar rollo" }));
    expect(alert).toHaveBeenCalledWith(
      '¿Borrar "Viaje al sur" para todos?',
      "Se borran todas las fotos de todos y no se puede deshacer.",
      expect.any(Array),
    );
    expect(alertButtons().map((b) => b.text)).toEqual(["Cancelar", "Borrar"]);
    expect(alertButtons().find((b) => b.text === "Borrar")).toMatchObject({ style: "destructive" });
    expect(trips.deleteTrip).not.toHaveBeenCalled();
  });

  it("deletes, cancels moments, clears the active rollo, refreshes the list and goes back to /roll", async () => {
    trips.deleteTrip.mockResolvedValue(undefined);
    await open(detail(creator));
    const before = trips.fetchMyTrips.mock.calls.length;
    await fireEvent.press(screen.getByRole("button", { name: "Borrar rollo" }));
    await act(async () => alertButtons().find((b) => b.text === "Borrar")!.onPress!());
    await waitFor(() => expect(trips.deleteTrip).toHaveBeenCalledWith(SUR));
    await waitFor(() => expect(dismissTo).toHaveBeenCalledWith("/roll"));
    expect(momentCancel.cancelMomentNotifications).toHaveBeenCalledWith(SUR);
    expect(await getActiveTripId()).toBeNull();
    expect(trips.fetchMyTrips.mock.calls.length).toBeGreaterThan(before);
  });

  it("a failing cleanup step doesn't hide the success: no error and it still goes back to /roll", async () => {
    trips.deleteTrip.mockResolvedValue(undefined);
    jest.mocked(momentCancel.cancelMomentNotifications).mockRejectedValueOnce(new Error("notifications down"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await open(detail(creator));
    await fireEvent.press(screen.getByRole("button", { name: "Borrar rollo" }));
    await act(async () => alertButtons().find((b) => b.text === "Borrar")!.onPress!());
    await waitFor(() => expect(dismissTo).toHaveBeenCalledWith("/roll"));
    expect(screen.queryByText("No se pudo borrar el rollo")).toBeNull();
    expect(await getActiveTripId()).toBeNull();
    warn.mockRestore();
  });

  it("shows the failure under the row and stays", async () => {
    trips.deleteTrip.mockRejectedValue(new Error("Solo quien creó el rollo puede hacer esto"));
    await open(detail(creator));
    await fireEvent.press(screen.getByRole("button", { name: "Borrar rollo" }));
    await act(async () => alertButtons().find((b) => b.text === "Borrar")!.onPress!());
    expect(await screen.findByText("Solo quien creó el rollo puede hacer esto")).toBeVisible();
    expect(dismissTo).not.toHaveBeenCalled();
    expect(await getActiveTripId()).toBe(SUR);
  });
});
