import { keepOriginals } from "@/test/trip";
import { Alert } from "react-native";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import "@/test/reanimated";
import * as friendActions from "@/features/friends/actions";
import * as tripActions from "@/features/trips/actions";
import { useSearchBar } from "@/features/friends/use-search-bar";
import { setActiveTripId } from "@/storage/active-trip";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/friends/actions");
jest.mock("@/features/trips/actions");
jest.mock("@/features/friends/use-search-bar");
const friends = jest.mocked(friendActions);
const trips = jest.mocked(tripActions);

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";

type Member = tripActions.TripDetail["members"][number];
const member = (over: Partial<Member> & Pick<Member, "id" | "userId" | "name">): Member => ({
  username: over.name.toLowerCase().replace(/\s/g, "."),
  avatarUrl: null,
  role: "member",
  isCreator: false,
  blockedByMe: false,
  ...over,
});

const creator = member({ id: "m1", userId: "u1", name: "Juani", role: "admin", isCreator: true });
const adminCami = member({ id: "m2", userId: "u2", name: "Cami", role: "admin" });
const jose = member({ id: "m3", userId: "u3", name: "José Gómez", username: "jose.g" });
const others = Array.from({ length: 97 }, (_, i) =>
  member({ id: `x${i}`, userId: `ux${i}`, name: `Persona ${String(i).padStart(2, "0")}`, username: `persona${i}` }),
);

const detail = (me: Member, members: Member[]): tripActions.TripDetail => ({
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
    type: "trip",
    coverUrl: null,
    groups: [],
    createdBy: { userId: "u1", name: "Juani" },
  },
  me: { ...me, groupIds: [] },
  members: members.map((x) => (x.id === me.id ? me : x)),
  today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 3,
});
const all = [creator, adminCami, jose, ...others]; // 100 members
const big = [...all, member({ id: "m9", userId: "u9", name: "Tomi" })]; // 101

const typed = (text: string) => jest.mocked(useSearchBar).mockReturnValue(text);
let alert: jest.SpyInstance;

async function openBoard(d: tripActions.TripDetail) {
  trips.fetchTrip.mockResolvedValue(d);
  await setActiveTripId(SUR);
  await renderRouter(routes, { initialUrl: "/roll" });
  await screen.findByText("Personas");
}
async function openMembers(d: tripActions.TripDetail) {
  trips.fetchTrip.mockResolvedValue(d);
  await setActiveTripId(SUR);
  await renderRouter(routes, { initialUrl: `/roll-members?tripId=${SUR}` });
  await waitFor(() =>
    expect(screen.queryAllByRole("button").length + screen.queryAllByText("No hay integrantes con ese nombre.").length).toBeGreaterThan(0),
  );
}
const act1 = (el: Parameters<typeof fireEvent>[0], actionName: string) =>
  fireEvent(el, "accessibilityAction", { nativeEvent: { actionName } });

beforeEach(async () => {
  for (const mock of [...Object.values(friends), ...Object.values(trips)]) (mock as Partial<jest.Mock>).mockReset?.();
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
  trips.fetchMyTrips.mockResolvedValue({ trips: [tripSummary(SUR, "Viaje al sur")] });
  trips.fetchFeedPage.mockResolvedValue({ revealed: false, revealAt: Date.now() + DAY, items: [], nextCursor: null });
  friends.fetchFriends.mockResolvedValue([]);
  friends.fetchFriendRequests.mockResolvedValue([]);
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  typed("");
});
afterEach(() => alert.mockRestore());

describe("Personas row on the board", () => {
  it("shows the total against the cap and a few faces, not the member list", async () => {
    await openBoard(detail(creator, big));
    expect(screen.getByText("101 de 15")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Cami, Admin" })).toBeNull();
    expect(screen.queryByText("Ver todos")).toBeNull();
  });

  it("opens the members screen for this roll", async () => {
    await openBoard(detail(creator, big));
    await fireEvent.press(screen.getByRole("button", { name: /^Personas/ }));
    await waitFor(() => expect(screen).toHavePathname("/roll-members"));
    expect(screen).toHaveSearchParams({ tripId: SUR });
  });

  it("with few members shows the real count", async () => {
    const eight = [creator, adminCami, jose, ...others.slice(0, 5)];
    await openBoard(detail(creator, eight));
    expect(screen.getByText("8 de 15")).toBeVisible();
  });
});

describe("Integrantes screen", () => {
  it("lists every member, same badges", async () => {
    await openMembers(detail(creator, big));
    expect(screen.getByRole("button", { name: "Cami, Admin" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Tomi" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: /^Persona \d+/ })).toHaveLength(97);
  });

  it("filters by name without accents", async () => {
    typed("jose");
    await openMembers(detail(creator, big));
    expect(screen.getByRole("button", { name: "José Gómez" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Tomi" })).toBeNull();
    expect(screen.queryAllByRole("button", { name: /^Persona \d+/ })).toHaveLength(0);
  });

  it("filters by @username", async () => {
    typed("@persona5");
    await openMembers(detail(creator, big));
    expect(screen.getByRole("button", { name: "Persona 05" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "José Gómez" })).toBeNull();
  });

  it("says so when nobody matches", async () => {
    typed("zzzz");
    await openMembers(detail(creator, big));
    expect(screen.getByText("No hay integrantes con ese nombre.")).toBeVisible();
  });

  it("tapping a member opens their profile", async () => {
    await openMembers(detail(creator, big));
    await fireEvent.press(screen.getByRole("button", { name: "José Gómez" }));
    await waitFor(() => expect(screen).toHavePathname("/user/u3"));
  });

  it("keeps the role actions for an admin and applies them", async () => {
    trips.makeAdmin.mockResolvedValue(jose);
    await openMembers(detail(adminCami, big));
    expect(screen.getAllByRole("menuitem", { name: "Hacer admin" }).length).toBeGreaterThan(0);
    await act1(screen.getByRole("button", { name: "José Gómez" }), "makeAdmin");
    await waitFor(() => expect(trips.makeAdmin).toHaveBeenCalledWith(SUR, "m3"));
  });

  it("asks before removing", async () => {
    await openMembers(detail(adminCami, big));
    await act1(screen.getByRole("button", { name: "José Gómez" }), "remove");
    expect(alert).toHaveBeenCalledWith("¿Sacar a José Gómez del rollo?", expect.any(String), expect.any(Array));
  });

  it("shows the failure on the screen", async () => {
    trips.makeAdmin.mockRejectedValue(new Error("Solo quien creó el rollo puede hacer esto"));
    await openMembers(detail(adminCami, big));
    await act1(screen.getByRole("button", { name: "José Gómez" }), "makeAdmin");
    expect(await screen.findByText("Solo quien creó el rollo puede hacer esto")).toBeVisible();
  });
});
