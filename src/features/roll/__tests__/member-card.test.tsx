import { keepOriginals } from "@/test/trip";
import { Alert } from "react-native";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import "@/test/reanimated";
import * as friendActions from "@/features/friends/actions";
import * as profileActions from "@/features/profile/actions";
import * as tripActions from "@/features/trips/actions";
import { setActiveTripId } from "@/storage/active-trip";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/friends/actions");
jest.mock("@/features/trips/actions");
const friends = jest.mocked(friendActions);
const trips = jest.mocked(tripActions);

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";

type Member = tripActions.TripDetail["members"][number];
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

const detail = (me: Member): tripActions.TripDetail => ({
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
    maxMembers: 15,
    photoLimitMode: "daily",
    totalPhotoLimit: null,
    momentMode: "off",
    momentWindowStart: 540,
    momentWindowEnd: 1380,
    originals: keepOriginals,
    description: null,
    contest: null,
    type: "trip",
    coverUrl: null,
    groups: [],
    createdBy: { userId: "u1", name: "Juani" },
  },
  me: { ...me, groupIds: [] },
  members: [creator, adminCami, fede, tomi].map((x) => (x.id === me.id ? me : x)),
  memberCount: 4,
  today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 3,
});

const profileOf = (m: Member, bio: string | null) => ({
  user: { id: m.userId, name: m.name, username: m.username, avatarUrl: null, bio, badge: null },
  isFriend: false,
  blockedByMe: false,
  reportedByMe: false,
  profileVisibility: "friends" as const,
  canSee: false,
  friendCount: 0,
  mutualCount: 0,
  friendRequest: "none" as const,
});

async function openCard(me: Member, target: Member) {
  trips.fetchTrip.mockResolvedValue(detail(me));
  await setActiveTripId(SUR);
  await renderRouter(routes, { initialUrl: `/member?tripId=${SUR}&memberId=${target.id}` });
  await screen.findByRole("button", { name: "Ver perfil" });
}

let alert: jest.SpyInstance;
let fetchUser: jest.SpyInstance;
beforeEach(async () => {
  for (const mock of [...Object.values(friends), ...Object.values(trips)]) (mock as Partial<jest.Mock>).mockReset?.();
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
  trips.fetchMyTrips.mockResolvedValue({ trips: [tripSummary(SUR, "Viaje al sur")] });
  friends.fetchFriends.mockResolvedValue([]);
  friends.fetchFriendRequests.mockResolvedValue([]);
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  fetchUser = jest.spyOn(profileActions, "fetchUser").mockImplementation(async (id) => profileOf([creator, adminCami, fede, tomi].find((m) => m.userId === id)!, "Me gusta el mate"));
});
afterEach(() => {
  alert.mockRestore();
  fetchUser.mockRestore();
});

describe("Member card", () => {
  it("shows name, @username, bio and role", async () => {
    await openCard(creator, adminCami);
    expect(screen.getByText("Cami")).toBeVisible();
    expect(screen.getByText("@cami")).toBeVisible();
    expect(await screen.findByText("Me gusta el mate")).toBeVisible();
    expect(screen.getByText("Admin")).toBeVisible();
  });

  it("omits the bio quietly when the profile fails", async () => {
    fetchUser.mockRejectedValue(new Error("boom"));
    await openCard(creator, adminCami);
    await waitFor(() => expect(fetchUser).toHaveBeenCalled());
    expect(screen.getByText("Cami")).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("Ver perfil goes to their profile", async () => {
    await openCard(adminCami, fede);
    await fireEvent.press(screen.getByRole("button", { name: "Ver perfil" }));
    await waitFor(() => expect(screen).toHavePathname("/user/u5"));
  });

  it("an admin sees Hacer admin and it makes them admin", async () => {
    trips.makeAdmin.mockResolvedValue(fede);
    await openCard(adminCami, fede);
    expect(screen.getByRole("button", { name: "Sacar del rollo" })).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Hacer admin" }));
    await waitFor(() => expect(trips.makeAdmin).toHaveBeenCalledWith(SUR, "m5"));
  });

  it("Sacar del rollo asks first", async () => {
    await openCard(adminCami, fede);
    await fireEvent.press(screen.getByRole("button", { name: "Sacar del rollo" }));
    expect(alert).toHaveBeenCalledWith("¿Sacar a Fede del rollo?", expect.any(String), expect.any(Array));
    expect(trips.removeMember).not.toHaveBeenCalled();
  });

  it("a plain member sees no action rows", async () => {
    await openCard(tomi, fede);
    expect(screen.queryByRole("button", { name: "Hacer admin" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sacar del rollo" })).toBeNull();
  });

  it("the creator target shows no actions", async () => {
    await openCard(adminCami, creator);
    expect(screen.getByText("Creador")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Hacer admin" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sacar del rollo" })).toBeNull();
  });
});
