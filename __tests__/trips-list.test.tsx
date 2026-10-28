import * as Burnt from "burnt";
import { Alert } from "react-native";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as friendsActions from "@/features/friends/actions";
import * as actions from "@/features/trips/actions";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/friends/actions");
const trips = jest.mocked(actions);
const friends = jest.mocked(friendsActions);

const DAY = 24 * 60 * 60 * 1000;
const recent = Date.now() - 5 * DAY;
const revealedMine = tripSummary("t1", "Sur", { revealed: true, revealAt: recent, isCreator: false, role: "member" });
const revealedCreated = tripSummary("t2", "Tandil", { revealed: true, revealAt: recent - DAY, isCreator: true });
const unrevealed = tripSummary("t3", "Playa", { revealed: false, isCreator: false, role: "member", revealAt: Date.now() + DAY, endsAt: Date.now() + DAY });
const archived1 = tripSummary("t4", "Viejo uno", { revealed: true, archived: true, revealAt: recent, isCreator: false, role: "member" });
const archived2 = tripSummary("t5", "Viejo dos", { revealed: true, archived: true, revealAt: recent - DAY, isCreator: false, role: "member" });

beforeEach(async () => {
  jest.clearAllMocks();
  trips.setTripArchived.mockResolvedValue(undefined);
  friends.leaveTrip.mockResolvedValue(undefined);
  await signInAs({ trips: [revealedMine, revealedCreated, unrevealed, archived1, archived2], active: "t1" });
});

const items = () => screen.queryAllByRole("menuitem").map((m) => m.props.accessibilityLabel as string);

describe("Tus rollos: archived and row actions", () => {
  it("shows 'Archivados · 2' collapsed at the end and opens it on tap", async () => {
    await renderRouter(routes, { initialUrl: "/trips" });
    const header = await screen.findByRole("button", { name: "Archivados, 2" });
    expect(screen.getByText("Archivados · 2")).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Viejo uno/ })).toBeNull();
    await fireEvent.press(header);
    expect(await screen.findByRole("button", { name: /^Viejo uno/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Viejo dos/ })).toBeVisible();
  });

  it("offers Archivar and Eliminar on a revealed roll you didn't create", async () => {
    await renderRouter(routes, { initialUrl: "/trips" });
    await screen.findByRole("button", { name: /^Sur/ });
    const sur = screen.getByRole("button", { name: /^Sur/ });
    expect(sur.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(["archive", "leave"]);
    expect(items()).toContain("Archivar");
    expect(items()).toContain("Eliminar");
  });

  it("has no Archivar on an unrevealed roll and no Eliminar on one you created", async () => {
    await renderRouter(routes, { initialUrl: "/trips" });
    const playa = await screen.findByRole("button", { name: /^Playa/ });
    expect(playa.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(["leave"]);
    const tandil = screen.getByRole("button", { name: /^Tandil/ });
    expect(tandil.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(["archive"]);
  });

  it("offers Desarchivar on an archived roll", async () => {
    await renderRouter(routes, { initialUrl: "/trips" });
    await fireEvent.press(await screen.findByRole("button", { name: "Archivados, 2" }));
    const row = await screen.findByRole("button", { name: /^Viejo uno/ });
    expect(row.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(["unarchive", "leave"]);
    expect(items()).toContain("Desarchivar");
  });

  it("Archivar calls setTripArchived and moves the row to Archivados without waiting, keeping the active roll", async () => {
    trips.setTripArchived.mockReturnValue(new Promise(() => {}));
    await renderRouter(routes, { initialUrl: "/trips" });
    await screen.findByRole("button", { name: /^Tandil/ });
    const tandil = screen.getByRole("button", { name: /^Tandil/ });
    await fireEvent(tandil, "accessibilityAction", { nativeEvent: { actionName: "archive" } });

    expect(trips.setTripArchived).toHaveBeenCalledWith("t2", true);
    expect(await screen.findByRole("button", { name: "Archivados, 3" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Tandil/ })).toBeNull();
    expect(screen).toHavePathname("/trips");
  });

  it("puts the roll back and alerts when archiving fails", async () => {
    trips.setTripArchived.mockRejectedValue(new Error("boom"));
    await renderRouter(routes, { initialUrl: "/trips" });
    await screen.findByRole("button", { name: /^Tandil/ });
    await fireEvent(screen.getByRole("button", { name: /^Tandil/ }), "accessibilityAction", { nativeEvent: { actionName: "archive" } });
    await waitFor(() => expect(Burnt.alert).toHaveBeenCalledWith(expect.objectContaining({ title: "No se pudo archivar" })));
    expect(await screen.findByRole("button", { name: /^Tandil/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Archivados, 2" })).toBeVisible();
  });

  it("Eliminar on a revealed roll warns that you can't come back, then leaves", async () => {
    const spy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderRouter(routes, { initialUrl: "/trips" });
    await screen.findByRole("button", { name: /^Sur/ });
    await fireEvent(screen.getByRole("button", { name: /^Sur/ }), "accessibilityAction", { nativeEvent: { actionName: "leave" } });
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
    await renderRouter(routes, { initialUrl: "/trips" });
    await screen.findByRole("button", { name: /^Playa/ });
    await fireEvent(screen.getByRole("button", { name: /^Playa/ }), "accessibilityAction", { nativeEvent: { actionName: "leave" } });
    expect(spy).toHaveBeenCalledWith(
      '¿Eliminar "Playa" de tus rollos?',
      "Salís del rollo y tus fotos se quedan para el grupo. Podés volver con el código.",
      expect.any(Array),
    );
    spy.mockRestore();
  });
});
