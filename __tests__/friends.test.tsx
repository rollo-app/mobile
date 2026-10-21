import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import { Alert, Share } from "react-native";
import * as actions from "@/features/friends/actions";
import * as tripActions from "@/features/trips/actions";
import { markPresentationSeen } from "@/storage/presentation";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";
import { tabBar } from "@/test/tab-bar";

jest.mock("@/features/friends/actions");
jest.mock("@/features/trips/actions");
const mocked = jest.mocked(actions);
const trips = jest.mocked(tripActions);

const DAY = 24 * 60 * 60 * 1000;

const revealedDetail = (): tripActions.TripDetail => ({
  trip: {
    id: "t1",
    name: "Viaje al sur",
    joinCode: "HUB5FT",
    timezone: "America/Argentina/Buenos_Aires",
    startsAt: Date.now() - 5 * DAY,
    endsAt: Date.now() - 2 * DAY,
    revealAt: Date.now() - DAY,
    revealed: true,
    dailyPhotoLimit: 10,
    dailyVideoLimit: 3,
  },
  me: { id: "m1", userId: "u1", name: "Juani", username: "juani", avatarUrl: null, role: "admin" },
  members: [{ id: "m1", userId: "u1", name: "Juani", username: "juani", avatarUrl: null, role: "admin" }],
  today: { date: "2027-01-12", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 3,
});

const cami: actions.Friend = { id: "u2", name: "Cami", username: "cami", avatarUrl: null, bio: null };
const tomi: actions.Friend = { id: "u3", name: "Tomi", username: "tomi", avatarUrl: null, bio: null };

let alert: jest.SpyInstance;
let share: jest.SpyInstance;

beforeEach(async () => {
  await signInAs({ trips: [tripSummary("t1", "Viaje al sur")] });
  mocked.fetchFriends.mockResolvedValue([cami, tomi]);
  trips.fetchTrip.mockReturnValue(new Promise(() => {}));
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction", activityType: undefined });
});

afterEach(() => {
  alert.mockRestore();
  share.mockRestore();
});

describe("Friends", () => {
  it("the bar has an Amigos tab between the camera and Perfil that opens the list", async () => {
    await renderRouter(routes, { initialUrl: "/friends" });

    expect(await screen.findByText("Cami")).toBeVisible();
    expect(screen).toHavePathname("/friends");
    expect(tabBar().map(([name]) => name)).toEqual(["roll", "map", "camera", "friends", "me"]);
    expect(tabBar()[3]).toEqual(["friends", "person.2"]);
  });

  it("Perfil no longer has an Amigos row", async () => {
    await renderRouter(routes, { initialUrl: "/me" });

    expect(await screen.findByRole("button", { name: "Ajustes" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Amigos/ })).toBeNull();
  });

  it("with no rolls the Amigos tab still shows the list and the invite", async () => {
    await signInAs({ trips: [] });
    await renderRouter(routes, { initialUrl: "/friends" });

    expect(await screen.findByText("Cami")).toBeVisible();
    expect(screen.getByRole("button", { name: "Invitar a un amigo" })).toBeVisible();
    expect(tabBar().map(([name]) => name)).toContain("friends");
  });

  it("after the reveal the Amigos tab is still there", async () => {
    trips.fetchTrip.mockResolvedValue(revealedDetail());
    trips.fetchFeed.mockResolvedValue({ revealed: true, revealAt: Date.now() - DAY, items: [] });
    await markPresentationSeen("t1");
    await renderRouter(routes, { initialUrl: "/friends" });

    expect(await screen.findByText("Cami")).toBeVisible();
    await waitFor(() => expect(tabBar()[0]![1]).toBe("square.grid.2x2"));
    expect(tabBar().map(([name]) => name)).toEqual(["roll", "map", "camera", "friends", "me"]);
  });

  it("tapping a friend opens their profile", async () => {
    await renderRouter(routes, { initialUrl: "/friends" });

    await fireEvent.press(await screen.findByRole("button", { name: /^Cami/ }));

    await waitFor(() => expect(screen).toHavePathname("/friends/user/u2"));
    expect(alert).not.toHaveBeenCalled();
  });

  it("lists photo or initial, name and handle", async () => {
    await renderRouter(routes, { initialUrl: "/friends" });

    expect(await screen.findByText("Cami")).toBeVisible();
    expect(screen.getByText("@cami")).toBeVisible();
    expect(screen.getByText("Tomi")).toBeVisible();
    for (const name of [/^Cami/, /^Tomi/]) {
      expect(within(screen.getByRole("button", { name })).getAllByTestId("avatar", { includeHiddenElements: true })).toHaveLength(1);
    }
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
    expect((share.mock.calls[0]![0] as { message: string }).message).toContain("rollo://friends/K7M2QX9A");
  });

  it("shows the error inline when the link can't be made", async () => {
    mocked.createFriendLink.mockRejectedValue(new Error("Sin conexión. Probá de nuevo cuando tengas señal."));
    await renderRouter(routes, { initialUrl: "/friends" });

    await fireEvent.press(await screen.findByRole("button", { name: "Invitar a un amigo" }));

    expect(await screen.findByText(/Sin conexión/)).toBeVisible();
  });
});
