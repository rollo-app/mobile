import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Alert, Share } from "react-native";
import * as actions from "@/features/friends/actions";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/friends/actions");
const mocked = jest.mocked(actions);

const cami: actions.Friend = { id: "u2", name: "Cami", username: "cami", avatarUrl: null };
const tomi: actions.Friend = { id: "u3", name: "Tomi", username: "tomi", avatarUrl: null };

let alert: jest.SpyInstance;
let share: jest.SpyInstance;

beforeEach(async () => {
  await signInAs({ trips: [tripSummary("t1", "Viaje al sur")] });
  mocked.fetchFriends.mockResolvedValue([cami, tomi]);
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction", activityType: undefined });
});

afterEach(() => {
  alert.mockRestore();
  share.mockRestore();
});

describe("Friends", () => {
  it("Perfil shows an Amigos row with the count and opens the list", async () => {
    await renderRouter(routes, { initialUrl: "/me" });

    await fireEvent.press(await screen.findByRole("button", { name: "Amigos, 2" }));

    await waitFor(() => expect(screen).toHavePathname("/friends"));
    expect(await screen.findByText("Cami")).toBeVisible();
  });

  it("lists photo or initial, name and handle", async () => {
    await renderRouter(routes, { initialUrl: "/friends" });

    expect(await screen.findByText("Cami")).toBeVisible();
    expect(screen.getByText("@cami")).toBeVisible();
    expect(screen.getByText("Tomi")).toBeVisible();
    expect(screen.getAllByTestId("avatar", { includeHiddenElements: true })).toHaveLength(2);
  });

  it("shows an empty state that still offers to invite", async () => {
    mocked.fetchFriends.mockResolvedValue([]);
    await renderRouter(routes, { initialUrl: "/friends" });

    expect(await screen.findByText(/Todavía no tenés amigos/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Invitar a un amigo" })).toBeVisible();
  });

  it("shows a retry when the list can't be loaded", async () => {
    mocked.fetchFriends.mockRejectedValueOnce(new Error("Sin conexión"));
    await renderRouter(routes, { initialUrl: "/friends" });

    expect(await screen.findByText("Sin conexión")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Cami")).toBeVisible();
  });

  it("'Invitar a un amigo' makes a link and shows the code and that it lasts an hour", async () => {
    mocked.createFriendLink.mockResolvedValue({ code: "K7M2QX9A", expiresAt: Date.now() + 3_600_000 });
    await renderRouter(routes, { initialUrl: "/friends" });

    await fireEvent.press(await screen.findByRole("button", { name: "Invitar a un amigo" }));

    expect(await screen.findByText("K7M2QX9A")).toBeVisible();
    expect(screen.getByText(/Vale 1 hora/)).toBeVisible();
  });

  it("'Compartir' shares the link", async () => {
    mocked.createFriendLink.mockResolvedValue({ code: "K7M2QX9A", expiresAt: Date.now() + 3_600_000 });
    await renderRouter(routes, { initialUrl: "/friends" });
    await fireEvent.press(await screen.findByRole("button", { name: "Invitar a un amigo" }));

    await fireEvent.press(await screen.findByRole("button", { name: "Compartir" }));

    expect(share).toHaveBeenCalledTimes(1);
    expect((share.mock.calls[0]![0] as { message: string }).message).toContain("rollo://amigos/K7M2QX9A");
  });

  it("shows the error inline when the link can't be made", async () => {
    mocked.createFriendLink.mockRejectedValue(new Error("Sin conexión. Probá de nuevo cuando tengas señal."));
    await renderRouter(routes, { initialUrl: "/friends" });

    await fireEvent.press(await screen.findByRole("button", { name: "Invitar a un amigo" }));

    expect(await screen.findByText(/Sin conexión/)).toBeVisible();
  });

  it("asks before removing a friend and then drops them from the list", async () => {
    mocked.removeFriend.mockResolvedValue();
    await renderRouter(routes, { initialUrl: "/friends" });

    await fireEvent.press(await screen.findByRole("button", { name: /^Cami/ }));

    expect(alert).toHaveBeenCalledTimes(1);
    expect(mocked.removeFriend).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === "Borrar amigo")!.onPress!();

    await waitFor(() => expect(screen.queryByText("Cami")).toBeNull());
    expect(mocked.removeFriend).toHaveBeenCalledWith("u2");
    expect(screen.getByText("Tomi")).toBeVisible();
  });

  it("keeps the friend and shows the error if removing fails", async () => {
    mocked.removeFriend.mockRejectedValue(new Error("No se pudo borrar"));
    await renderRouter(routes, { initialUrl: "/friends" });
    await fireEvent.press(await screen.findByRole("button", { name: /^Cami/ }));
    const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === "Borrar amigo")!.onPress!();

    expect(await screen.findByText("No se pudo borrar")).toBeVisible();
    expect(screen.getByText("Cami")).toBeVisible();
  });
});
