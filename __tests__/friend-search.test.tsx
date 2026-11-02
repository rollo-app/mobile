import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as actions from "@/features/friends/actions";
import { useSearchBar } from "@/features/friends/use-search-bar";
import { signInAs } from "@/test/account";
import { routes } from "@/test/routes";
import * as featuredActions from "@/features/featured/actions";

jest.mock("@/features/friends/actions");
jest.mock("@/features/friends/use-search-bar");
jest.mock("@/features/featured/actions");
const mocked = jest.mocked(actions);

const cami: actions.Friend = { id: "u2", name: "Cami", username: "cami", avatarUrl: null, bio: null };
const camilo = (over: Partial<actions.UserSearchResult> = {}): actions.UserSearchResult => ({
  id: "u9",
  name: "Camilo Pérez",
  username: "cami.p",
  avatarUrl: null,
  mutualCount: 3,
  friendRequest: "none",
  ...over,
});

const typed = (text: string) => jest.mocked(useSearchBar).mockReturnValue(text);

beforeEach(async () => {
  jest.mocked(featuredActions).fetchFeatured.mockResolvedValue([]);
  await signInAs();
  mocked.fetchFriends.mockResolvedValue([cami]);
  mocked.fetchFriendRequests.mockResolvedValue([]);
  mocked.searchUsers.mockResolvedValue([camilo()]);
  typed("");
});

describe("Friends search", () => {
  it("shows the normal tab with no text", async () => {
    await renderRouter(routes, { initialUrl: "/friends" });
    expect(await screen.findByText("Invitar a un amigo")).toBeVisible();
    expect(mocked.searchUsers).not.toHaveBeenCalled();
  });

  it("with one character shows only matching friends", async () => {
    typed("c");
    await renderRouter(routes, { initialUrl: "/friends" });
    expect(await screen.findByText("Cami")).toBeVisible();
    expect(screen.getAllByText("Amigos").length).toBeGreaterThan(0);
    expect(screen.queryByText("Invitar a un amigo")).toBeNull();
    expect(screen.queryByText("Personas")).toBeNull();
    expect(mocked.searchUsers).not.toHaveBeenCalled();
  });

  it("shows Amigos and Personas", async () => {
    typed("cami");
    await renderRouter(routes, { initialUrl: "/friends" });
    expect(await screen.findByText("Camilo Pérez")).toBeVisible();
    expect(screen.getAllByText("Amigos").length).toBeGreaterThan(0);
    expect(screen.getByText("Personas")).toBeVisible();
    expect(screen.getByText("@cami.p · 3 en común")).toBeVisible();
    expect(screen.getByLabelText("Agregar a Camilo Pérez")).toBeVisible();
  });

  it("Agregar turns into Enviada at once", async () => {
    typed("cami");
    mocked.sendFriendRequest.mockImplementation(async () => {
      mocked.searchUsers.mockResolvedValue([camilo({ friendRequest: "sent" })]);
      return "sent";
    });
    await renderRouter(routes, { initialUrl: "/friends" });
    await fireEvent.press(await screen.findByLabelText("Agregar a Camilo Pérez"));
    expect(await screen.findByLabelText("Solicitud enviada a Camilo Pérez, cancelar")).toBeVisible();
    expect(mocked.sendFriendRequest).toHaveBeenCalledWith("u9");
  });

  it("tapping a row opens the profile", async () => {
    typed("cami");
    await renderRouter(routes, { initialUrl: "/friends" });
    await fireEvent.press(await screen.findByText("Camilo Pérez"));
    await waitFor(() => expect(screen).toHavePathname("/friends/user/u9"));
  });

  it("shows the empty message", async () => {
    typed("zz");
    mocked.searchUsers.mockResolvedValue([]);
    await renderRouter(routes, { initialUrl: "/friends" });
    expect(await screen.findByText('No encontramos a nadie con "zz".')).toBeVisible();
  });

  it("does not show the empty message while a friend matches", async () => {
    typed("cami");
    mocked.searchUsers.mockResolvedValue([]);
    await renderRouter(routes, { initialUrl: "/friends" });
    expect(await screen.findByText("Cami")).toBeVisible();
    await waitFor(() => expect(mocked.searchUsers).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByText(/No encontramos a nadie/)).toBeNull();
  });

  it("reads name, handle and mutual friends in one label for VoiceOver", async () => {
    typed("cami");
    await renderRouter(routes, { initialUrl: "/friends" });
    expect(await screen.findByLabelText("Camilo Pérez, @cami.p, 3 en común")).toBeVisible();
    expect(screen.getByLabelText("Cami, @cami, Amigos")).toBeVisible();
  });

  it("shows the error with Reintentar and keeps the friends section", async () => {
    typed("ca");
    mocked.searchUsers.mockRejectedValue(new Error("boom"));
    await renderRouter(routes, { initialUrl: "/friends" });
    expect(await screen.findByText("Reintentar")).toBeVisible();
    expect(screen.getByText("Cami")).toBeVisible();
    mocked.searchUsers.mockResolvedValue([camilo()]);
    await fireEvent.press(screen.getByText("Reintentar"));
    expect(await screen.findByText("Camilo Pérez")).toBeVisible();
  });

  it("shows the footnote with 20 results", async () => {
    typed("ca");
    mocked.searchUsers.mockResolvedValue(Array.from({ length: 20 }, (_, i) => camilo({ id: `p${i}`, name: `Persona ${i}`, username: `p${i}` })));
    await renderRouter(routes, { initialUrl: "/friends" });
    expect(await screen.findByText("Si no está, escribí más de su nombre o su @.")).toBeVisible();
  });
});
