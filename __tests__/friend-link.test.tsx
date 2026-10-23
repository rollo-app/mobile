import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { ApiError } from "@/api/client";
import * as friendActions from "@/features/friends/actions";
import * as profileActions from "@/features/profile/actions";
import { getPendingFriend, setPendingFriend } from "@/storage/pending-friend";
import { signInAs, tripSummary, USER } from "@/test/account";
import { routes } from "@/test/routes";
import * as featuredActions from "@/features/featured/actions";

jest.mock("@/features/friends/actions");
// Perfil is mounted too: its featured photos stay loading, so its own update or "Reintentar" stays out of the way.
jest.mock("@/features/featured/actions");
beforeEach(() => {
  jest.mocked(featuredActions).fetchFeatured.mockReturnValue(new Promise(() => {}));
});
jest.mock("@/features/profile/actions");
const friends = jest.mocked(friendActions);
const profile = jest.mocked(profileActions);

const CODE = "K7M2QX9A";
const cami: friendActions.Friend = { id: "u2", name: "Cami", username: "cami", avatarUrl: null, bio: null };
const claimed = (token = "ct1"): friendActions.FriendClaim => ({
  claimToken: token,
  expiresAt: Date.now() + 86_400_000,
  creator: { name: "Cami", username: "cami", avatarUrl: null },
});

beforeEach(() => {
  for (const mock of [...Object.values(friends), ...Object.values(profile)]) (mock as Partial<jest.Mock>).mockReset?.();
  friends.fetchFriends.mockResolvedValue([cami]);
  friends.claimFriendLink.mockResolvedValue(claimed());
  friends.redeemFriend.mockResolvedValue(cami);
});

describe("Opening a friend link", () => {
  describe("without a session", () => {
    it("claims the link, keeps the permission and goes to sign in", async () => {
      await renderRouter(routes, { initialUrl: `/friends/${CODE}` });

      await waitFor(() => expect(screen).toHavePathname("/email"));
      expect(friends.claimFriendLink).toHaveBeenCalledWith(CODE);
      expect(friends.redeemFriend).not.toHaveBeenCalled();
      expect(await getPendingFriend()).toEqual({ claimToken: "ct1", creatorName: "Cami" });
    });

    it("a second link replaces the pending one", async () => {
      await setPendingFriend({ claimToken: "old", creatorName: "Tomi" });
      friends.claimFriendLink.mockResolvedValue(claimed("ct2"));
      await renderRouter(routes, { initialUrl: `/friends/${CODE}` });

      await waitFor(() => expect(screen).toHavePathname("/email"));
      expect(await getPendingFriend()).toEqual({ claimToken: "ct2", creatorName: "Cami" });
    });

    it("an invalid or expired link shows the message on the screen, keeps the old pending one and doesn't navigate away", async () => {
      await setPendingFriend({ claimToken: "old", creatorName: "Tomi" });
      friends.claimFriendLink.mockRejectedValue(new ApiError(400, "Código incorrecto o vencido"));
      await renderRouter(routes, { initialUrl: `/friends/${CODE}` });

      expect(await screen.findByText("Código incorrecto o vencido")).toBeVisible();
      expect(screen).toHavePathname(`/friends/${CODE}`);
      expect(await getPendingFriend()).toEqual({ claimToken: "old", creatorName: "Tomi" });

      await fireEvent.press(screen.getByRole("button", { name: "Seguir" }));
      await waitFor(() => expect(screen).toHavePathname("/email"));
    });

    it("a malformed code is rejected without asking the server", async () => {
      await renderRouter(routes, { initialUrl: "/friends/hola" });

      expect(await screen.findByText("Código incorrecto o vencido")).toBeVisible();
      expect(friends.claimFriendLink).not.toHaveBeenCalled();
    });
  });

  describe("with a session and a complete profile", () => {
    beforeEach(() => signInAs({ trips: [tripSummary("t1", "Viaje al sur")] }));

    it("claims, redeems and lands on the friends list with the new friend", async () => {
      await renderRouter(routes, { initialUrl: `/friends/${CODE}` });

      await waitFor(() => expect(screen).toHavePathname("/friends"));
      expect(friends.claimFriendLink).toHaveBeenCalledWith(CODE);
      expect(friends.redeemFriend).toHaveBeenCalledWith({ claimToken: "ct1" });
      expect(await screen.findByText("Cami")).toBeVisible();
      expect(await getPendingFriend()).toBeNull();
    });

    it("an invalid link shows the message and stays", async () => {
      friends.claimFriendLink.mockRejectedValue(new ApiError(400, "Código incorrecto o vencido"));
      await renderRouter(routes, { initialUrl: `/friends/${CODE}` });

      expect(await screen.findByText("Código incorrecto o vencido")).toBeVisible();
      expect(friends.redeemFriend).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByRole("button", { name: "Seguir" }));
      await waitFor(() => expect(screen).toHavePathname("/roll"));
    });

    it("opening your own link (or an existing friend's) is not an error", async () => {
      friends.redeemFriend.mockResolvedValue({ ...cami, id: USER.id, name: USER.name! });
      friends.fetchFriends.mockResolvedValue([]);
      await renderRouter(routes, { initialUrl: `/friends/${CODE}` });

      await waitFor(() => expect(screen).toHavePathname("/friends"));
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("signing up with a pending link", () => {
    const newcomer = { ...USER, name: null, username: null };
    beforeEach(() => {
      profile.updateProfile.mockResolvedValue(USER);
      profile.checkUsername.mockResolvedValue({ available: true, username: "juani" });
    });

    // Finishing the profile mounts the tabs, and the hidden Amigos tab loads its list: let that update
    // land inside the test that caused it, not in the next one's act().
    const settle = () => screen.findByText("Cami", { includeHiddenElements: true });

    async function completeProfile(friendCode?: string) {
      await fireEvent.changeText(await screen.findByLabelText("Tu nombre"), "Juani");
      expect(await screen.findByText("Disponible")).toBeVisible();
      if (friendCode !== undefined) await fireEvent.changeText(screen.getByLabelText("¿Te invitó un amigo? Código"), friendCode);
      await fireEvent.press(screen.getByRole("button", { name: "Listo" }));
    }

    it("a signed-in account with no profile still keeps the link, and redeems it once the profile is done", async () => {
      await signInAs({ user: newcomer });
      await renderRouter(routes, { initialUrl: `/friends/${CODE}` });
      await waitFor(() => expect(screen).toHavePathname("/profile"));
      expect(friends.redeemFriend).not.toHaveBeenCalled();

      await completeProfile();

      await waitFor(() => expect(friends.redeemFriend).toHaveBeenCalledTimes(1));
      expect(friends.redeemFriend).toHaveBeenCalledWith({ claimToken: "ct1" });
      await waitFor(async () => expect(await getPendingFriend()).toBeNull());
      await settle();
    });

    it("still finishes the sign-up if redeeming fails, and drops a pending link the server rejects", async () => {
      await signInAs({ user: newcomer });
      await setPendingFriend({ claimToken: "ct1", creatorName: "Cami" });
      friends.redeemFriend.mockRejectedValue(new ApiError(400, "Código incorrecto o vencido"));
      await renderRouter(routes, { initialUrl: "/profile" });

      await completeProfile();

      await waitFor(() => expect(screen).toHavePathname("/roll"));
      await waitFor(async () => expect(await getPendingFriend()).toBeNull());
      await settle();
    });

    it("keeps the pending link when there was no signal to redeem it", async () => {
      await signInAs({ user: newcomer });
      await setPendingFriend({ claimToken: "ct1", creatorName: "Cami" });
      friends.redeemFriend.mockRejectedValue(new ApiError(0, "Sin conexión. Probá de nuevo cuando tengas señal."));
      await renderRouter(routes, { initialUrl: "/profile" });

      await completeProfile();

      await waitFor(() => expect(friends.redeemFriend).toHaveBeenCalled());
      await waitFor(() => expect(screen).toHavePathname("/roll"));
      expect(await getPendingFriend()).toEqual({ claimToken: "ct1", creatorName: "Cami" });
      await settle();
    });

    it("the optional 'Te invitó un amigo' field claims the typed code and redeems it at the end", async () => {
      await signInAs({ user: newcomer });
      await renderRouter(routes, { initialUrl: "/profile" });

      await completeProfile("k7m2-qx9a");

      expect(friends.claimFriendLink).toHaveBeenCalledWith(CODE);
      await waitFor(() => expect(friends.redeemFriend).toHaveBeenCalledWith({ claimToken: "ct1" }));
      await settle();
    });

    it("a wrong friend code shows the error inline and doesn't save the profile", async () => {
      await signInAs({ user: newcomer });
      friends.claimFriendLink.mockRejectedValue(new ApiError(400, "Código incorrecto o vencido"));
      await renderRouter(routes, { initialUrl: "/profile" });

      await completeProfile(CODE);

      expect(await screen.findByText("Código incorrecto o vencido")).toBeVisible();
      expect(profile.updateProfile).not.toHaveBeenCalled();
      expect(screen).toHavePathname("/profile");
    });

    it("an empty friend field changes nothing", async () => {
      await signInAs({ user: newcomer });
      await renderRouter(routes, { initialUrl: "/profile" });

      await completeProfile();

      await waitFor(() => expect(screen).toHavePathname("/roll"));
      expect(friends.claimFriendLink).not.toHaveBeenCalled();
      expect(friends.redeemFriend).not.toHaveBeenCalled();
      await settle();
    });

    it("editing an existing profile has no friend field", async () => {
      await signInAs({ trips: [tripSummary("t1", "Viaje al sur")] });
      await renderRouter(routes, { initialUrl: "/edit-profile" });

      await screen.findByLabelText("Tu nombre");
      expect(screen.queryByLabelText("¿Te invitó un amigo? Código")).toBeNull();
    });
  });
});
