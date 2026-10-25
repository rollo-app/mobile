import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as friendActions from "@/features/friends/actions";
import * as moderation from "@/features/moderation/actions";
import * as profileActions from "@/features/profile/actions";
import * as tripActions from "@/features/trips/actions";
import * as featuredActions from "@/features/featured/actions";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";
import { Alert } from "react-native";

jest.mock("@/features/trips/actions");
jest.mock("@/features/friends/actions");
jest.mock("@/features/featured/actions");
jest.mock("@/features/moderation/actions");

const SUR = "11111111-1111-4111-8111-111111111111";
const cami: friendActions.Friend = { id: "u2", name: "Cami", username: "cami", avatarUrl: null, bio: null };

const profile = (blockedByMe: boolean): profileActions.UserProfile => ({
  user: { ...cami, badge: null },
  isFriend: false,
  blockedByMe,
  reportedByMe: false,
  profileVisibility: "friends",
  canSee: false,
  friendCount: 0,
  mutualCount: 0,
});

beforeEach(async () => {
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
  jest.mocked(friendActions).fetchFriends.mockResolvedValue([]);
  jest.mocked(featuredActions).fetchFeatured.mockResolvedValue([]);
  jest.mocked(tripActions).fetchMyTrips.mockResolvedValue({ trips: [tripSummary(SUR, "Viaje al sur")] });
  jest.mocked(tripActions).fetchTrip.mockReturnValue(new Promise(() => {}));
  jest.mocked(tripActions).fetchFeed.mockReturnValue(new Promise(() => {}));
  jest.mocked(moderation).unblockUser.mockReset().mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

describe("Bloqueados", () => {
  it("Ajustes shows Bloqueados only when someone is blocked, and unblocking from the profile removes them", async () => {
    let blocked = [cami];
    jest.mocked(moderation).fetchBlocked.mockImplementation(async () => blocked);
    jest.mocked(moderation).unblockUser.mockImplementation(async () => {
      blocked = [];
    });
    jest.spyOn(profileActions, "fetchUser").mockImplementation(async () => profile(blocked.length > 0));
    await renderRouter(routes, { initialUrl: "/settings" });

    await fireEvent.press(await screen.findByRole("button", { name: "Bloqueados" }));
    await waitFor(() => expect(screen).toHavePathname("/blocked"));
    expect(await screen.findByText("@cami")).toBeVisible();

    await fireEvent.press(screen.getByRole("button", { name: "Cami" }));
    await waitFor(() => expect(screen).toHavePathname("/user/u2"));
    await fireEvent.press(await screen.findByRole("button", { name: "Desbloquear" }));

    await waitFor(() => expect(moderation.unblockUser).toHaveBeenCalledWith("u2"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Desbloquear" })).toBeNull());
  });

  it("Ajustes hides Bloqueados when nobody is blocked", async () => {
    jest.mocked(moderation).fetchBlocked.mockResolvedValue([]);
    await renderRouter(routes, { initialUrl: "/settings" });

    await screen.findByRole("switch", { name: "Perfil público" });
    await waitFor(() => expect(moderation.fetchBlocked).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Bloqueados" })).toBeNull();
  });

  it("says when you blocked nobody", async () => {
    jest.mocked(moderation).fetchBlocked.mockResolvedValue([]);
    await renderRouter(routes, { initialUrl: "/blocked" });

    expect(await screen.findByText("No bloqueaste a nadie.")).toBeVisible();
  });
});

describe("Members", () => {
  it("members list shows Bloqueado", async () => {
    const member = (id: string, userId: string, name: string, role: "admin" | "member", blockedByMe: boolean) => ({
      id,
      userId,
      name,
      username: null,
      avatarUrl: null,
      role,
      blockedByMe,
    });
    const me = member("m1", "u1", "Juani", "admin", false);
    jest.mocked(moderation).fetchBlocked.mockResolvedValue([]);
    jest.mocked(tripActions).fetchTrip.mockResolvedValue({
      trip: {
        id: SUR,
        name: "Viaje al sur",
        joinCode: "HUB5FT",
        timezone: "America/Argentina/Buenos_Aires",
        startsAt: Date.now() - 1000,
        endsAt: Date.now() + 100000,
        revealAt: Date.now() + 200000,
        revealed: false,
        dailyPhotoLimit: 10,
        dailyVideoLimit: 3,
        photoLimitMode: "daily",
        totalPhotoLimit: null,
      },
      me,
      members: [me, member("m2", "u2", "Cami", "member", true)],
      today: { date: "2027-01-12", photosLeft: 7, videosLeft: 2 },
      totalUploaded: 0,
    });
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByText("Bloqueado")).toBeVisible();
    expect(screen.getByText("Admin")).toBeVisible();
  });
});
