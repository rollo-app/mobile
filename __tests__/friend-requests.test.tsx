import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import * as actions from "@/features/friends/actions";
import * as featuredActions from "@/features/featured/actions";
import * as profileActions from "@/features/profile/actions";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/friends/actions");
jest.mock("@/features/featured/actions");
const mocked = jest.mocked(actions);

const cami: actions.Friend = { id: "u2", name: "Cami", username: "cami", avatarUrl: null, bio: null };
const tomi: actions.Friend = { id: "u3", name: "Tomi", username: "tomi", avatarUrl: null, bio: null };

let friendRequest: profileActions.UserProfile["friendRequest"];
let isFriend: boolean;
let blockedByMe: boolean;

const profile = (friend: actions.Friend): profileActions.UserProfile => ({
  user: { ...friend, badge: null },
  isFriend,
  blockedByMe,
  reportedByMe: false,
  profileVisibility: "friends",
  canSee: isFriend,
  friendCount: 4,
  mutualCount: 1,
  friendRequest,
});

beforeEach(async () => {
  friendRequest = "none";
  isFriend = false;
  blockedByMe = false;
  await signInAs({ trips: [tripSummary("t1", "Viaje al sur")] });
  jest.mocked(featuredActions).fetchFeatured.mockResolvedValue([]);
  mocked.fetchFriends.mockResolvedValue([]);
  mocked.fetchFriendRequests.mockResolvedValue([]);
  mocked.fetchFriend.mockResolvedValue({ friend: cami, commonTrips: [] });
  jest.spyOn(profileActions, "fetchUser").mockImplementation(async (id) => profile(id === "u3" ? tomi : cami));
  jest.spyOn(profileActions, "fetchUserFriends").mockResolvedValue({ scope: "mutual", friends: [] });
});

afterEach(() => jest.restoreAllMocks());

describe("friend request button on a profile", () => {
  it("offers 'Agregar amigo' to someone who is not a friend and sends the request, turning into 'Solicitud enviada'", async () => {
    mocked.sendFriendRequest.mockImplementation(async () => {
      friendRequest = "sent";
      return "sent";
    });
    await renderRouter(routes, { initialUrl: "/user/u2" });

    await fireEvent.press(await screen.findByRole("button", { name: "Agregar amigo" }));

    expect(mocked.sendFriendRequest).toHaveBeenCalledWith("u2");
    expect(await screen.findByRole("button", { name: "Solicitud enviada" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Agregar amigo" })).toBeNull();
  });

  it("turns into 'Solicitud enviada' at once, before the server answers", async () => {
    mocked.sendFriendRequest.mockReturnValue(new Promise(() => {}));
    await renderRouter(routes, { initialUrl: "/user/u2" });

    await fireEvent.press(await screen.findByRole("button", { name: "Agregar amigo" }));

    expect(await screen.findByRole("button", { name: "Solicitud enviada" })).toBeVisible();
  });

  it("goes back and shows the error under the button when sending fails", async () => {
    mocked.sendFriendRequest.mockRejectedValue(new Error("Mandaste muchas solicitudes hoy. Probá de nuevo mañana"));
    await renderRouter(routes, { initialUrl: "/user/u2" });

    await fireEvent.press(await screen.findByRole("button", { name: "Agregar amigo" }));

    expect(await screen.findByText("Mandaste muchas solicitudes hoy. Probá de nuevo mañana")).toBeVisible();
    expect(screen.getByRole("button", { name: "Agregar amigo" })).toBeVisible();
  });

  it("shows 'Solicitud enviada' when you sent one and cancels it by tapping it again", async () => {
    friendRequest = "sent";
    mocked.cancelFriendRequest.mockImplementation(async () => {
      friendRequest = "none";
    });
    await renderRouter(routes, { initialUrl: "/user/u2" });

    expect(await screen.findByRole("button", { name: "Solicitud enviada" })).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: "Cancelar solicitud" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Solicitud enviada" }));

    expect(mocked.cancelFriendRequest).toHaveBeenCalledWith("u2");
    expect(await screen.findByRole("button", { name: "Agregar amigo" })).toBeVisible();
  });

  it("shows 'Aceptar solicitud' and 'Rechazar' when they asked you; accepting makes you friends", async () => {
    friendRequest = "received";
    mocked.acceptFriendRequest.mockImplementation(async () => {
      friendRequest = "none";
      isFriend = true;
      return cami;
    });
    await renderRouter(routes, { initialUrl: "/user/u2" });

    expect(await screen.findByRole("button", { name: "Rechazar" })).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Aceptar solicitud" }));

    expect(mocked.acceptFriendRequest).toHaveBeenCalledWith("u2");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Aceptar solicitud" })).toBeNull());
    expect(screen.queryByRole("button", { name: "Rechazar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Agregar amigo" })).toBeNull();
  });

  it("rejecting hides the buttons and offers to add them again", async () => {
    friendRequest = "received";
    mocked.rejectFriendRequest.mockImplementation(async () => {
      friendRequest = "none";
    });
    await renderRouter(routes, { initialUrl: "/user/u2" });

    await fireEvent.press(await screen.findByRole("button", { name: "Rechazar" }));

    expect(mocked.rejectFriendRequest).toHaveBeenCalledWith("u2");
    expect(await screen.findByRole("button", { name: "Agregar amigo" })).toBeVisible();
  });

  it("sending when they had asked you too can end up friends: the profile refreshes", async () => {
    mocked.sendFriendRequest.mockImplementation(async () => {
      isFriend = true;
      return "friends";
    });
    await renderRouter(routes, { initialUrl: "/user/u2" });

    await fireEvent.press(await screen.findByRole("button", { name: "Agregar amigo" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Solicitud enviada" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Agregar amigo" })).toBeNull();
    });
  });

  it("has no button for a friend", async () => {
    isFriend = true;
    await renderRouter(routes, { initialUrl: "/user/u2" });
    expect(await screen.findByText("@cami")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Agregar amigo" })).toBeNull();
  });

  it("has no button for a blocked person", async () => {
    blockedByMe = true;
    await renderRouter(routes, { initialUrl: "/user/u2" });
    expect(await screen.findByRole("button", { name: "Desbloquear" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Agregar amigo" })).toBeNull();
  });

  it("has no button on your own profile", async () => {
    jest.spyOn(profileActions, "fetchUser").mockImplementation(async () => profile({ ...cami, id: "u1" }));
    await renderRouter(routes, { initialUrl: "/user/u1" });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Agregar amigo" })).toBeNull());
  });
});

describe("Solicitudes row in the Amigos tab", () => {
  it("shows no row when there are no requests", async () => {
    await renderRouter(routes, { initialUrl: "/friends" });
    await waitFor(() => expect(mocked.fetchFriendRequests).toHaveBeenCalled());
    expect(screen.queryByText("Solicitudes")).toBeNull();
  });

  it("shows one row with the count that opens the requests screen", async () => {
    mocked.fetchFriendRequests.mockResolvedValue([
      { user: cami, createdAt: Date.now() },
      { user: tomi, createdAt: Date.now() - 1000 },
    ]);
    await renderRouter(routes, { initialUrl: "/friends" });

    const row = await screen.findByRole("button", { name: "Solicitudes, 2" });
    expect(screen.queryByText("Cami")).toBeNull();
    await fireEvent.press(row);

    await waitFor(() => expect(screen).toHavePathname("/friends/requests"));
    expect(await screen.findByText("Cami")).toBeVisible();
    expect(screen.getByText("Tomi")).toBeVisible();
  });
});

describe("Solicitudes screen", () => {
  it("shows who asked, and accepting moves them to the friends list and updates the tab row", async () => {
    mocked.fetchFriendRequests.mockResolvedValue([
      { user: cami, createdAt: Date.now() },
      { user: tomi, createdAt: Date.now() - 1000 },
    ]);
    mocked.acceptFriendRequest.mockImplementation(async () => {
      mocked.fetchFriendRequests.mockResolvedValue([{ user: tomi, createdAt: Date.now() }]);
      mocked.fetchFriends.mockResolvedValue([cami]);
      return cami;
    });
    await renderRouter(routes, { initialUrl: "/friends/requests" });

    expect(await screen.findByText("Cami")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Aceptar solicitud de Cami" }));

    expect(mocked.acceptFriendRequest).toHaveBeenCalledWith("u2");
    await waitFor(() => expect(screen.queryByText("Cami")).toBeNull());
    expect(screen.getByText("Tomi")).toBeVisible();
    await waitFor(() => expect(mocked.fetchFriends.mock.calls.length).toBeGreaterThan(1));
  });

  it("rejecting removes the row", async () => {
    mocked.fetchFriendRequests.mockResolvedValue([
      { user: cami, createdAt: Date.now() },
      { user: tomi, createdAt: Date.now() - 1000 },
    ]);
    mocked.rejectFriendRequest.mockImplementation(async () => {
      mocked.fetchFriendRequests.mockResolvedValue([{ user: tomi, createdAt: Date.now() }]);
    });
    await renderRouter(routes, { initialUrl: "/friends/requests" });

    await fireEvent.press(await screen.findByRole("button", { name: "Rechazar solicitud de Cami" }));

    expect(mocked.rejectFriendRequest).toHaveBeenCalledWith("u2");
    await waitFor(() => expect(screen.queryByText("Cami")).toBeNull());
    expect(screen.getByText("Tomi")).toBeVisible();
  });

  it("says there are none after answering the last one", async () => {
    mocked.fetchFriendRequests.mockResolvedValue([{ user: cami, createdAt: Date.now() }]);
    mocked.rejectFriendRequest.mockImplementation(async () => {
      mocked.fetchFriendRequests.mockResolvedValue([]);
    });
    await renderRouter(routes, { initialUrl: "/friends/requests" });

    await fireEvent.press(await screen.findByRole("button", { name: "Rechazar solicitud de Cami" }));

    expect(await screen.findByText("No tenés solicitudes pendientes.")).toBeVisible();
  });

  it("tapping a row opens their profile", async () => {
    mocked.fetchFriendRequests.mockResolvedValue([{ user: cami, createdAt: Date.now() }]);
    await renderRouter(routes, { initialUrl: "/friends/requests" });

    await fireEvent.press(await screen.findByRole("button", { name: "Cami" }));

    await waitFor(() => expect(screen).toHavePathname("/friends/user/u2"));
  });

  it("shows the error when answering fails, keeping the row", async () => {
    mocked.fetchFriendRequests.mockResolvedValue([{ user: cami, createdAt: Date.now() }]);
    mocked.acceptFriendRequest.mockRejectedValue(new Error("No hay una solicitud de esa persona"));
    await renderRouter(routes, { initialUrl: "/friends/requests" });

    await fireEvent.press(await screen.findByRole("button", { name: "Aceptar solicitud de Cami" }));

    expect(await screen.findByText("No hay una solicitud de esa persona")).toBeVisible();
    expect(screen.getByText("Cami")).toBeVisible();
  });

  it("shows a retry when loading fails", async () => {
    mocked.fetchFriendRequests.mockRejectedValueOnce(new Error("Sin conexión"));
    mocked.fetchFriendRequests.mockResolvedValue([{ user: cami, createdAt: Date.now() }]);
    await renderRouter(routes, { initialUrl: "/friends/requests" });

    const error = await screen.findByText("Sin conexión");
    await fireEvent.press(within(error.parent!.parent!).getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Cami")).toBeVisible();
  });
});
