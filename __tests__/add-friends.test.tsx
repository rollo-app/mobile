import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Alert } from "react-native";
import * as friendActions from "@/features/friends/actions";
import * as tripActions from "@/features/trips/actions";
import { getActiveTripId, setActiveTripId } from "@/storage/active-trip";
import { markPresentationSeen } from "@/storage/presentation";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/friends/actions");
jest.mock("@/features/trips/actions");
const friends = jest.mocked(friendActions);
const trips = jest.mocked(tripActions);

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";

const cami: friendActions.Friend = { id: "u2", name: "Cami", username: "cami", avatarUrl: null, bio: null };
const tomi: friendActions.Friend = { id: "u3", name: "Tomi", username: "tomi", avatarUrl: null, bio: null };
const fede: friendActions.Friend = { id: "u5", name: "Fede", username: "fede.s", avatarUrl: null, bio: null };

const detail = (over: Partial<tripActions.Trip> = {}, role: "admin" | "member" = "admin"): tripActions.TripDetail => ({
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
    ...over,
  },
  me: { id: "m1", userId: "u1", name: "Juani", username: "juani", avatarUrl: null, role, blockedByMe: false },
  members: [
    { id: "m1", userId: "u1", name: "Juani", username: "juani", avatarUrl: null, role, blockedByMe: false },
    { id: "m5", userId: "u5", name: "Fede", username: "fede.s", avatarUrl: null, role: "member", blockedByMe: false },
  ],
  today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 3,
});

let alert: jest.SpyInstance;

beforeEach(async () => {
  for (const mock of [...Object.values(friends), ...Object.values(trips)]) (mock as Partial<jest.Mock>).mockReset?.();
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
  trips.fetchTrip.mockResolvedValue(detail());
  trips.fetchMyTrips.mockResolvedValue({ trips: [tripSummary(SUR, "Viaje al sur")] });
  trips.fetchFeed.mockResolvedValue({ revealed: false, revealAt: Date.now() + DAY, items: [] });
  friends.fetchFriends.mockResolvedValue([cami, tomi, fede]);
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => alert.mockRestore());

const openSheet = async () => {
  await renderRouter(routes, { initialUrl: "/roll" });
  await fireEvent.press(await screen.findByRole("button", { name: "Sumar amigos" }));
  await waitFor(() => expect(screen).toHavePathname("/add-friends"));
};

describe("Add friends to a roll", () => {
  it("the board offers 'Sumar amigos' next to the invite code", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByRole("button", { name: "Sumar amigos" })).toBeVisible();
    expect(screen.getByText("Invitar")).toBeVisible();
  });

  it("lists your friends, marks the ones already in as 'Ya está' and lets you pick the rest", async () => {
    await openSheet();

    expect(await screen.findByText("Cami")).toBeVisible();
    expect(screen.getByText("Ya está")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: /^Fede/ })).toBeDisabled();

    await fireEvent.press(screen.getByRole("checkbox", { name: /^Cami/ }));
    await fireEvent.press(screen.getByRole("checkbox", { name: /^Tomi/ }));
    expect(screen.getByRole("checkbox", { name: /^Cami/ })).toBeChecked();
    await fireEvent.press(screen.getByRole("checkbox", { name: /^Tomi/ }));
    expect(screen.getByRole("checkbox", { name: /^Tomi/ })).not.toBeChecked();
  });

  it("'Sumar' is disabled until you pick someone", async () => {
    await openSheet();

    await screen.findByText("Cami");
    expect(screen.getByRole("button", { name: "Sumar" })).toBeDisabled();
  });

  it("adds the picked friends, closes the sheet and refreshes the roll's members", async () => {
    friends.addFriendsToTrip.mockResolvedValue([
      { userId: "u2", status: "added" },
      { userId: "u3", status: "added" },
    ]);
    await openSheet();
    await fireEvent.press(await screen.findByRole("checkbox", { name: /^Cami/ }));
    await fireEvent.press(screen.getByRole("checkbox", { name: /^Tomi/ }));
    const before = trips.fetchTrip.mock.calls.length;

    await fireEvent.press(screen.getByRole("button", { name: "Sumar" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(friends.addFriendsToTrip).toHaveBeenCalledWith(SUR, ["u2", "u3"]);
    await waitFor(() => expect(trips.fetchTrip.mock.calls.length).toBeGreaterThan(before));
  });

  it("an unavailable friend is flagged inline and the sheet stays open", async () => {
    friends.addFriendsToTrip.mockResolvedValue([
      { userId: "u2", status: "added" },
      { userId: "u3", status: "unavailable" },
    ]);
    await openSheet();
    await fireEvent.press(await screen.findByRole("checkbox", { name: /^Cami/ }));
    await fireEvent.press(screen.getByRole("checkbox", { name: /^Tomi/ }));

    await fireEvent.press(screen.getByRole("button", { name: "Sumar" }));

    expect(await screen.findByText("No disponible")).toBeVisible();
    expect(screen).toHavePathname("/add-friends");
    expect(screen.getByRole("checkbox", { name: /^Tomi/ })).toBeDisabled();
  });

  it("shows the server's message inline if the roll was already revealed", async () => {
    friends.addFriendsToTrip.mockRejectedValue(new Error("Este rollo ya se reveló"));
    await openSheet();
    await fireEvent.press(await screen.findByRole("checkbox", { name: /^Cami/ }));

    await fireEvent.press(screen.getByRole("button", { name: "Sumar" }));

    expect(await screen.findByText("Este rollo ya se reveló")).toBeVisible();
    expect(screen).toHavePathname("/add-friends");
    expect(screen.getByRole("checkbox", { name: /^Cami/ })).toBeChecked();
  });

  it("with no friends it says so and points to the friends screen", async () => {
    friends.fetchFriends.mockResolvedValue([]);
    await openSheet();

    expect(await screen.findByText(/Todavía no tenés amigos/)).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Ir a Amigos" }));
    await waitFor(() => expect(screen).toHavePathname("/friends"));
  });

  it("after the reveal the 'Rollo' segment no longer offers to add friends", async () => {
    trips.fetchTrip.mockResolvedValue(detail({ revealed: true, revealAt: Date.now() - DAY }));
    await markPresentationSeen(SUR);
    await renderRouter(routes, { initialUrl: "/roll?view=roll" });

    expect(await screen.findByText("Invitar")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Sumar amigos" })).toBeNull();
    expect(screen.getByRole("button", { name: "Salirme del rollo" })).toBeVisible();
  });
});

describe("Leaving a roll", () => {
  const confirmLeave = () =>
    act(async () => {
      const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
      buttons.find((b) => b.text === "Salirme")!.onPress!();
    });

  it("asks first, then leaves, goes back to the board and the roll disappears", async () => {
    friends.leaveTrip.mockResolvedValue();
    await setActiveTripId(SUR);
    await renderRouter(routes, { initialUrl: "/roll" });
    await fireEvent.press(await screen.findByRole("button", { name: "Salirme del rollo" }));

    expect(alert).toHaveBeenCalledTimes(1);
    expect(friends.leaveTrip).not.toHaveBeenCalled();
    trips.fetchMyTrips.mockResolvedValue({ trips: [] });
    await confirmLeave();

    expect(await screen.findByText("Todavía no tenés rollos")).toBeVisible();
    expect(friends.leaveTrip).toHaveBeenCalledWith(SUR);
    expect(screen).toHavePathname("/roll");
    expect(await getActiveTripId()).toBeNull();
  });

  it("the admin can't: the server's message shows inline and the roll stays", async () => {
    friends.leaveTrip.mockRejectedValue(new Error("Sos el admin: no podés salirte del rollo"));
    await renderRouter(routes, { initialUrl: "/roll" });
    await fireEvent.press(await screen.findByRole("button", { name: "Salirme del rollo" }));
    await confirmLeave();

    expect(await screen.findByText("Sos el admin: no podés salirte del rollo")).toBeVisible();
    expect(screen.getByText("Fechas")).toBeVisible();
  });
});
