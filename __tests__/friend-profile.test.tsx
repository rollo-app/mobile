import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { ActionSheetIOS, Alert } from "react-native";
import * as moderation from "@/features/moderation/actions";
import { ApiError } from "@/api/client";
import * as actions from "@/features/friends/actions";
import * as tripActions from "@/features/trips/actions";
import { getActiveTripId } from "@/storage/active-trip";
import { markPresentationSeen } from "@/storage/presentation";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";
import { tabBar } from "@/test/tab-bar";
import * as featuredActions from "@/features/featured/actions";
import * as profileActions from "@/features/profile/actions";
import { featuredPhoto } from "@/test/featured";
// The navigation bar is drawn natively: its options are read from the container instead.
import { navigationRef } from "expo-router/build/global-state/navigationRef";

jest.mock("@/features/friends/actions");
jest.mock("@/features/moderation/actions");
// Perfil is mounted too: nobody has featured photos, so its own "Reintentar" stays out of the way.
jest.mock("@/features/featured/actions");
beforeEach(() => {
  jest.mocked(featuredActions).fetchFeatured.mockResolvedValue([]);
});
jest.mock("@/features/trips/actions");
const mocked = jest.mocked(actions);
const trips = jest.mocked(tripActions);

const cami: actions.Friend = { id: "u2", name: "Cami", username: "cami", avatarUrl: null, bio: "Fotos analógicas y mate" };
const tomi: actions.Friend = { id: "u3", name: "Tomi", username: "tomi", avatarUrl: null, bio: null };

// Midday UTC, so the day is the same in any zone the tests run in.
const sur: actions.CommonTrip = { id: "t1", name: "Viaje al sur", startsAt: Date.UTC(2027, 0, 3, 15), endsAt: Date.UTC(2027, 0, 12, 15), revealed: false };
const bariloche: actions.CommonTrip = { id: "t3", name: "Bariloche", startsAt: Date.UTC(2025, 6, 10, 15), endsAt: Date.UTC(2025, 6, 14, 15), revealed: true };
const escapada: actions.CommonTrip = { id: "t2", name: "Escapada", startsAt: Date.UTC(2026, 10, 20, 15), endsAt: Date.UTC(2026, 10, 22, 15), revealed: false };

const DAY = 24 * 60 * 60 * 1000;

const detail = (id: string, name: string, revealed: boolean): tripActions.TripDetail => ({
  trip: {
    id,
    name,
    joinCode: "HUB5FT",
    timezone: "America/Argentina/Buenos_Aires",
    startsAt: Date.now() - (revealed ? 5 : 1) * DAY,
    endsAt: Date.now() + (revealed ? -2 : 2) * DAY,
    revealAt: Date.now() + (revealed ? -1 : 3) * DAY,
    revealed,
    dailyPhotoLimit: 10,
    dailyVideoLimit: 3,
    featuringDisabled: false,
  },
  me: { id: "m1", userId: "u1", name: "Juani", username: "juani", avatarUrl: null, role: "admin", blockedByMe: false },
  members: [{ id: "m1", userId: "u1", name: "Juani", username: "juani", avatarUrl: null, role: "admin", blockedByMe: false }],
  today: { date: "2027-01-12", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 0,
});

const myTrips = [
  tripSummary("t1", "Viaje al sur"),
  tripSummary("t2", "Escapada"),
  tripSummary("t3", "Bariloche", { revealed: true }),
  tripSummary("t4", "Fiesta", { revealed: true }),
];

let alert: jest.SpyInstance;
let fetchUser: jest.SpyInstance;
let fetchUserFriends: jest.SpyInstance;

/** `GET /users/{id}` for someone: by default a friend you can see. */
const userProfile = (friend: actions.Friend, over: Partial<profileActions.UserProfile> = {}): profileActions.UserProfile => ({
  user: { ...friend, badge: null },
  isFriend: true,
  blockedByMe: false,
  reportedByMe: false,
  profileVisibility: "friends",
  canSee: true,
  friendCount: 12,
  mutualCount: 0,
  ...over,
});

const lu: actions.Friend = { id: "u9", name: "Lu", username: "lu", avatarUrl: "/avatars/u9/1.jpg", bio: null };

beforeEach(async () => {
  await signInAs({ trips: myTrips, active: "t1" });
  mocked.fetchFriend.mockResolvedValue({ friend: cami, commonTrips: [sur, bariloche] });
  mocked.fetchFriends.mockResolvedValue([cami, tomi]);
  trips.fetchTrip.mockReturnValue(new Promise(() => {}));
  // The Mapa tab mounts too: keep its feed loading so its own "Reintentar" stays out of the way.
  trips.fetchFeed.mockReturnValue(new Promise(() => {}));
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  fetchUser = jest
    .spyOn(profileActions, "fetchUser")
    .mockImplementation(async (id: string) => userProfile(id === "u3" ? tomi : cami));
  fetchUserFriends = jest.spyOn(profileActions, "fetchUserFriends").mockResolvedValue({ scope: "all", friends: [] });
  jest.mocked(featuredActions).fetchFeatured.mockClear();
  mocked.fetchFriend.mockClear();
});

afterEach(() => {
  alert.mockRestore();
  fetchUser.mockRestore();
  fetchUserFriends.mockRestore();
});

const confirmRemoval = () => {
  const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
  buttons.find((b) => b.text === "Borrar amigo")!.onPress!();
};

describe("Friend profile", () => {
  it("shows the friend's header, showcase and the rolls in common with their dates", async () => {
    await renderRouter(routes, { initialUrl: "/friends/user/u2" });

    expect(await screen.findByText("@cami")).toBeVisible();
    expect(mocked.fetchFriend).toHaveBeenCalledWith("u2");
    expect(screen.getAllByText("Cami").length).toBeGreaterThan(0);
    expect(screen.getByText("Fotos analógicas y mate")).toBeVisible();
    // The friend's showcase (Perfil, mounted in its own tab, has yours).
    expect(await screen.findByText("Todavía no destacó fotos.")).toBeVisible();
    expect(featuredActions.fetchFeatured).toHaveBeenCalledWith("u2");
    expect(screen.getByText("Rollos en común")).toBeVisible();
    expect(screen.getByRole("button", { name: "Viaje al sur" })).toBeVisible();
    expect(screen.getByText("3 – 12 ene 2027")).toBeVisible();
    expect(screen.getByRole("button", { name: "Bariloche, Revelado" })).toBeVisible();
  });

  it("says when there are no rolls in common", async () => {
    mocked.fetchFriend.mockResolvedValue({ friend: cami, commonTrips: [] });
    await renderRouter(routes, { initialUrl: "/friends/user/u2" });

    expect(await screen.findByText("Todavía no tienen rollos en común.")).toBeVisible();
  });

  it("tapping a roll in common makes it the active one and opens Rollo", async () => {
    await renderRouter(routes, { initialUrl: "/friends/user/u2" });

    await fireEvent.press(await screen.findByRole("button", { name: "Bariloche, Revelado" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(await getActiveTripId()).toBe("t3");
  });

  it("opening a roll in common in another phase updates the tab bar", async () => {
    trips.fetchTrip.mockImplementation(async (id: string) => (id === "t3" ? detail("t3", "Bariloche", true) : detail("t1", "Viaje al sur", false)));
    await markPresentationSeen("t3");
    await renderRouter(routes, { initialUrl: "/friends/user/u2" });
    await waitFor(() => expect(tabBar()[2]![1]).toBe("camera.fill"));

    await fireEvent.press(await screen.findByRole("button", { name: "Bariloche, Revelado" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    await waitFor(() => expect(tabBar()[2]![1]).toBe("play.rectangle.fill"));
    expect(tabBar()[0]![1]).toBe("square.grid.2x2");
  });

  it("'Sumar a un rollo' lists only your unrevealed rolls without them, and adding one shows it in common", async () => {
    mocked.addFriendsToTrip.mockResolvedValue([{ userId: "u2", status: "added" }]);
    await renderRouter(routes, { initialUrl: "/friends/user/u2" });

    expect(await screen.findByText("Sumar a un rollo")).toBeVisible();
    const tripNames = myTrips.map((t) => t.name);
    const offered = screen.getAllByRole("menuitem").map((m) => m.props.accessibilityLabel as string);
    expect(offered.filter((name) => tripNames.includes(name))).toEqual(["Escapada"]);

    mocked.fetchFriend.mockResolvedValue({ friend: cami, commonTrips: [sur, escapada, bariloche] });
    await fireEvent.press(screen.getByRole("menuitem", { name: "Escapada" }));

    expect(mocked.addFriendsToTrip).toHaveBeenCalledWith("t2", ["u2"]);
    expect(await screen.findByRole("button", { name: "Escapada" })).toBeVisible();
    await waitFor(() => expect(screen.queryByText("Sumar a un rollo")).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("while adding, the 'Sumar a un rollo' options are disabled and a second pick is ignored", async () => {
    mocked.addFriendsToTrip.mockClear().mockReturnValue(new Promise(() => {}));
    await renderRouter(routes, { initialUrl: "/friends/user/u2" });

    await fireEvent.press(await screen.findByRole("menuitem", { name: "Escapada" }));

    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Escapada" })).toBeDisabled());
    await fireEvent.press(screen.getByRole("menuitem", { name: "Escapada" }));
    expect(mocked.addFriendsToTrip).toHaveBeenCalledTimes(1);
  });

  it("says inline when the friend can't be added", async () => {
    mocked.addFriendsToTrip.mockResolvedValue([{ userId: "u2", status: "unavailable" }]);
    await renderRouter(routes, { initialUrl: "/friends/user/u2" });

    await fireEvent.press(await screen.findByRole("menuitem", { name: "Escapada" }));

    expect(await screen.findByText("No se pudo sumar a Cami")).toBeVisible();
  });

  it("shows the server's message when adding fails (the roll was revealed meanwhile)", async () => {
    mocked.addFriendsToTrip.mockRejectedValue(new ApiError(409, "El rollo ya se reveló"));
    await renderRouter(routes, { initialUrl: "/friends/user/u2" });

    await fireEvent.press(await screen.findByRole("menuitem", { name: "Escapada" }));

    expect(await screen.findByText("El rollo ya se reveló")).toBeVisible();
    expect(screen.getByText("@cami")).toBeVisible();
  });

  it("without rolls to add them to, there's no 'Sumar a un rollo'", async () => {
    mocked.fetchFriend.mockResolvedValue({ friend: cami, commonTrips: [sur, escapada, bariloche] });
    await renderRouter(routes, { initialUrl: "/friends/user/u2" });

    expect(await screen.findByText("@cami")).toBeVisible();
    expect(screen.queryByText("Sumar a un rollo")).toBeNull();
  });

  it("shows a retry when the profile can't be loaded", async () => {
    fetchUser.mockRejectedValueOnce(new ApiError(0, "Sin conexión"));
    await renderRouter(routes, { initialUrl: "/friends/user/u2" });

    expect(await screen.findByText("Sin conexión")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("@cami")).toBeVisible();
  });

  it("asks before removing a friend and then goes back to the list without them", async () => {
    mocked.removeFriend.mockResolvedValue();
    await renderRouter(routes, { initialUrl: "/friends" });
    await fireEvent.press(await screen.findByRole("button", { name: /^Cami/ }));

    await fireEvent.press(await screen.findByRole("button", { name: "Borrar amigo" }));

    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0]![0]).toBe("¿Borrar a Cami de tus amigos?");
    expect(mocked.removeFriend).not.toHaveBeenCalled();
    confirmRemoval();

    await waitFor(() => expect(screen).toHavePathname("/friends"));
    expect(mocked.removeFriend).toHaveBeenCalledWith("u2");
    expect(await screen.findByText("Tomi")).toBeVisible();
    expect(screen.queryByText("Cami")).toBeNull();
  });

  it("removing from a profile opened directly also lands on the list", async () => {
    mocked.removeFriend.mockResolvedValue();
    await renderRouter(routes, { initialUrl: "/friends/user/u2" });

    await fireEvent.press(await screen.findByRole("button", { name: "Borrar amigo" }));
    confirmRemoval();

    await waitFor(() => expect(screen).toHavePathname("/friends"));
  });

  it("keeps the profile and shows the error if removing fails", async () => {
    mocked.removeFriend.mockRejectedValue(new Error("No se pudo borrar"));
    await renderRouter(routes, { initialUrl: "/friends/user/u2" });

    await fireEvent.press(await screen.findByRole("button", { name: "Borrar amigo" }));
    confirmRemoval();

    expect(await screen.findByText("No se pudo borrar")).toBeVisible();
    expect(screen).toHavePathname("/friends/user/u2");
  });
});

describe("Badge on someone's profile", () => {
  it("shows the badge the server sends", async () => {
    const base = userProfile(lu, { isFriend: false, canSee: false });
    fetchUser.mockResolvedValue({ ...base, user: { ...base.user, badge: "first_edition" } });
    await renderRouter(routes, { initialUrl: "/user/u9" });

    expect(await screen.findByText("FIRST EDITION")).toBeVisible();
    expect(screen.getByLabelText("Insignia: First Edition")).toBeVisible();
  });

  it("shows nothing without a badge", async () => {
    fetchUser.mockResolvedValue(userProfile(lu, { isFriend: false, canSee: false }));
    await renderRouter(routes, { initialUrl: "/user/u9" });

    await screen.findByText("Este perfil es privado");
    expect(screen.queryByLabelText(/^Insignia/)).toBeNull();
  });
});

describe("Profile of someone who isn't your friend", () => {
  it("private: only their name, @ and photo, says it's private and offers no friend actions", async () => {
    fetchUser.mockResolvedValue(userProfile(lu, { isFriend: false, canSee: false }));
    await renderRouter(routes, { initialUrl: "/user/u9" });

    expect(await screen.findByText("Este perfil es privado")).toBeVisible();
    expect(fetchUser).toHaveBeenCalledWith("u9");
    expect(screen.getByText("@lu")).toBeVisible();
    expect(screen.getAllByText("Lu").length).toBeGreaterThan(0);
    expect(screen.queryByText("Rollos en común")).toBeNull();
    expect(screen.queryByText("Sumar a un rollo")).toBeNull();
    expect(screen.queryByRole("button", { name: "Borrar amigo" })).toBeNull();
    expect(mocked.fetchFriend).not.toHaveBeenCalled();
    expect(featuredActions.fetchFeatured).not.toHaveBeenCalledWith("u9");
  });

  it("private non-friend with no friends in common shows no friend count line", async () => {
    fetchUser.mockResolvedValue(userProfile(lu, { isFriend: false, canSee: false, friendCount: 12, mutualCount: 0 }));
    await renderRouter(routes, { initialUrl: "/user/u9" });

    expect(await screen.findByText("Este perfil es privado")).toBeVisible();
    expect(screen.queryByText(/amigos/)).toBeNull();
  });

  it("public: their description and featured photos, still without friend actions", async () => {
    fetchUser.mockResolvedValue(userProfile({ ...lu, bio: "Sacando fotos del cielo" }, { isFriend: false, blockedByMe: false, reportedByMe: false, profileVisibility: "public" }));
    jest.mocked(featuredActions).fetchFeatured.mockImplementation(async (id) => (id === "u9" ? [featuredPhoto("p1", {}, "u9")] : []));
    await renderRouter(routes, { initialUrl: "/user/u9" });

    expect(await screen.findByText("Sacando fotos del cielo")).toBeVisible();
    expect(await screen.findByRole("button", { name: "Foto destacada" })).toBeVisible();
    expect(screen.queryByText("Este perfil es privado")).toBeNull();
    expect(screen.queryByText("Rollos en común")).toBeNull();
    expect(screen.queryByRole("button", { name: "Borrar amigo" })).toBeNull();
    expect(mocked.fetchFriend).not.toHaveBeenCalled();
  });

  it("a friend opened from outside Amigos shows the friend profile with their rolls in common", async () => {
    await renderRouter(routes, { initialUrl: "/user/u2" });

    expect(await screen.findByText("Rollos en común")).toBeVisible();
    expect(mocked.fetchFriend).toHaveBeenCalledWith("u2");
    expect(screen.getByRole("button", { name: "Borrar amigo" })).toBeVisible();
  });

  it("someone who removed you meanwhile shows as a non-friend, without friend actions", async () => {
    mocked.fetchFriend.mockRejectedValue(new ApiError(404, "Not found"));
    await renderRouter(routes, { initialUrl: "/friends/user/u2" });

    expect(await screen.findByText("@cami")).toBeVisible();
    await waitFor(() => expect(mocked.fetchFriend).toHaveBeenCalled());
    expect(screen.queryByText("Rollos en común")).toBeNull();
    expect(screen.queryByRole("button", { name: "Borrar amigo" })).toBeNull();
    expect(screen.queryByText("No es tu amigo")).toBeNull();
  });
});

describe("Someone's profile header", () => {
  it("has no title in the navigation bar: the name is already in the header", async () => {
    fetchUser.mockResolvedValue(userProfile(lu, { isFriend: false, canSee: false }));
    await renderRouter(routes, { initialUrl: "/user/u9" });

    await screen.findByText("@lu");
    await waitFor(() => expect(navigationRef.getCurrentOptions()).toEqual(expect.objectContaining({ title: "" })));
  });

  it("has no title inside Amigos either", async () => {
    await renderRouter(routes, { initialUrl: "/friends/user/u3" });

    await screen.findByText("@tomi");
    await waitFor(() => expect(navigationRef.getCurrentOptions()).toEqual(expect.objectContaining({ title: "" })));
  });

  it("shows the description of a private profile that isn't your friend", async () => {
    fetchUser.mockResolvedValue(userProfile({ ...lu, bio: "Sacando fotos del cielo" }, { isFriend: false, canSee: false }));
    await renderRouter(routes, { initialUrl: "/user/u9" });

    expect(await screen.findByText("Sacando fotos del cielo")).toBeVisible();
    expect(screen.getByText("Este perfil es privado")).toBeVisible();
  });

  it("shows how many friends they have, singular and plural", async () => {
    fetchUser.mockResolvedValue(userProfile(lu, { isFriend: false, canSee: false, friendCount: 1, mutualCount: 1 }));
    await renderRouter(routes, { initialUrl: "/user/u9" });
    expect(await screen.findByRole("button", { name: "1 amigo · 1 en común" })).toBeVisible();
  });

  it("adds how many are in common", async () => {
    fetchUser.mockResolvedValue(userProfile(lu, { isFriend: false, canSee: false, friendCount: 12, mutualCount: 3 }));
    await renderRouter(routes, { initialUrl: "/user/u9" });

    expect(await screen.findByRole("button", { name: "12 amigos · 3 en común" })).toBeVisible();
  });

  it("without friends in common it only shows the count", async () => {
    await renderRouter(routes, { initialUrl: "/user/u2" });

    expect(await screen.findByRole("button", { name: "12 amigos" })).toBeVisible();
  });
});

describe("Someone's friends", () => {
  const ana = { id: "u5", name: "Ana", username: "ana", avatarUrl: null };

  it("tapping the count opens their whole list when you can see their profile", async () => {
    fetchUserFriends.mockResolvedValue({ scope: "all", friends: [ana, { id: "u3", name: "Tomi", username: "tomi", avatarUrl: null }] });
    await renderRouter(routes, { initialUrl: "/user/u2" });

    await fireEvent.press(await screen.findByRole("button", { name: "12 amigos" }));

    await waitFor(() => expect(screen).toHavePathname("/user/u2/friends"));
    expect(fetchUserFriends).toHaveBeenCalledWith("u2");
    expect(await screen.findByRole("button", { name: "Ana" })).toBeVisible();
    expect(navigationRef.getCurrentOptions()).toEqual(expect.objectContaining({ title: "Amigos" }));
    expect(screen.queryByText(/Su perfil es privado/)).toBeNull();
  });

  it("only the friends in common on a private profile, with the explanation", async () => {
    fetchUserFriends.mockResolvedValue({ scope: "mutual", friends: [ana] });
    await renderRouter(routes, { initialUrl: "/user/u9/friends" });

    expect(await screen.findByText(/Su perfil es privado/)).toBeVisible();
    expect(navigationRef.getCurrentOptions()).toEqual(expect.objectContaining({ title: "Amigos en común" }));
    expect(screen.getByText("Su perfil es privado: solo ves los amigos que tienen en común.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Ana" })).toBeVisible();
  });

  it("says when they have no friends", async () => {
    await renderRouter(routes, { initialUrl: "/user/u9/friends" });
    expect(await screen.findByText("Todavía no tiene amigos.")).toBeVisible();
  });

  it("says when you have no friends in common", async () => {
    fetchUserFriends.mockResolvedValue({ scope: "mutual", friends: [] });
    await renderRouter(routes, { initialUrl: "/user/u9/friends" });
    expect(await screen.findByText("No tienen amigos en común.")).toBeVisible();
  });

  it("tapping someone in the list opens their profile", async () => {
    fetchUserFriends.mockResolvedValue({ scope: "all", friends: [ana] });
    fetchUser.mockImplementation(async (id: string) => userProfile(id === "u5" ? { ...ana, bio: null } : cami, { isFriend: id !== "u5" }));
    await renderRouter(routes, { initialUrl: "/user/u2/friends" });

    await fireEvent.press(await screen.findByRole("button", { name: "Ana" }));

    await waitFor(() => expect(screen).toHavePathname("/user/u5"));
    expect(await screen.findByText("@ana")).toBeVisible();
  });

  it("tapping yourself in the list opens your Perfil", async () => {
    fetchUserFriends.mockResolvedValue({ scope: "all", friends: [{ id: "u1", name: "Juani", username: "juani", avatarUrl: null }] });
    await renderRouter(routes, { initialUrl: "/user/u2/friends" });

    await fireEvent.press(await screen.findByRole("button", { name: "Juani" }));

    await waitFor(() => expect(screen).toHavePathname("/me"));
  });

  it("shows a retry when the list can't be loaded", async () => {
    fetchUserFriends.mockRejectedValueOnce(new Error("Sin conexión")).mockResolvedValue({ scope: "all", friends: [ana] });
    await renderRouter(routes, { initialUrl: "/user/u2/friends" });

    expect(await screen.findByText("Sin conexión")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("button", { name: "Ana" })).toBeVisible();
  });
});

describe("Moderation from a profile", () => {
  const pressAlert = (label: string) =>
    alert.mockImplementation((_t, _m, buttons) => {
      buttons!.find((b: { text?: string }) => b.text === label)!.onPress!();
    });

  beforeEach(() => {
    jest.mocked(moderation).blockUser.mockReset().mockResolvedValue(undefined);
    jest.mocked(moderation).unblockUser.mockReset().mockResolvedValue(undefined);
    jest.mocked(moderation).reportUser.mockReset().mockResolvedValue(undefined);
    jest.mocked(moderation).fetchBlocked.mockReset().mockResolvedValue([]);
  });

  it("blocking from a profile confirms, calls blockUser and shows Desbloquear", async () => {
    pressAlert("Bloquear");
    await renderRouter(routes, { initialUrl: "/user/u2" });
    await screen.findByText("@cami");

    jest.mocked(moderation).blockUser.mockImplementation(async () => {
      fetchUser.mockImplementation(async () => userProfile(cami, { blockedByMe: true, isFriend: false, canSee: false, friendCount: 0 }));
    });
    await fireEvent.press(await screen.findByRole("menuitem", { name: "Bloquear" }));

    expect(alert).toHaveBeenCalledWith("¿Bloquear a Cami?", expect.any(String), expect.any(Array));
    await waitFor(() => expect(moderation.blockUser).toHaveBeenCalledWith("u2"));
    expect(await screen.findByRole("button", { name: "Desbloquear" })).toBeVisible();
  });

  it("reporting a person shows Denunciaste a esta persona", async () => {
    const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_o, cb) => cb(0));
    await renderRouter(routes, { initialUrl: "/user/u2" });
    await screen.findByText("@cami");
    expect(screen.queryByText("Denunciaste a esta persona")).toBeNull();

    fetchUser.mockImplementation(async () => userProfile(cami, { reportedByMe: true }));
    await fireEvent.press(await screen.findByRole("menuitem", { name: "Denunciar" }));

    await waitFor(() => expect(moderation.reportUser).toHaveBeenCalledWith("u2", "offensive"));
    expect(await screen.findByText("Denunciaste a esta persona")).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: "Denunciar" })).toBeNull();
    sheet.mockRestore();
  });

  it("a blocked profile hides featured photos and friends", async () => {
    fetchUser.mockImplementation(async () => userProfile(cami, { blockedByMe: true, isFriend: true, canSee: false, friendCount: 0 }));
    mocked.fetchFriend.mockResolvedValue({ friend: cami, commonTrips: [sur] });
    await renderRouter(routes, { initialUrl: "/user/u2" });

    expect(await screen.findByRole("button", { name: "Desbloquear" })).toBeVisible();
    expect(screen.getByText("@cami")).toBeVisible();
    expect(screen.queryByText("Rollos en común")).toBeNull();
    expect(screen.queryByText("Este perfil es privado")).toBeNull();
    expect(screen.queryByText("Todavía no destacó fotos.")).toBeNull();
    expect(featuredActions.fetchFeatured).not.toHaveBeenCalledWith("u2");
  });

  it("your own profile has no moderation menu", async () => {
    fetchUser.mockImplementation(async () => userProfile({ id: "u1", name: "Juani", username: "juani", avatarUrl: null, bio: null }));
    await renderRouter(routes, { initialUrl: "/user/u1" });
    await screen.findByText("@juani");

    expect(screen.queryByRole("menuitem", { name: "Bloquear" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Denunciar" })).toBeNull();
  });
});
