import { ActionSheetIOS } from "react-native";
import { act, fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import * as likeActions from "@/features/likes/actions";
import * as featuredActions from "@/features/featured/actions";
import * as moderationActions from "@/features/moderation/actions";
import * as friendActions from "@/features/friends/actions";
import * as actions from "@/features/trips/actions";
import { signInAs, tripSummary } from "@/test/account";
import { CAMI, featuredPhoto, JUANI } from "@/test/featured";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/friends/actions");
jest.mock("@/features/featured/actions");
jest.mock("@/features/likes/actions");
jest.mock("@/features/moderation/actions");
const moderation = jest.mocked(moderationActions);
const featured = jest.mocked(featuredActions);
const likes = jest.mocked(likeActions);

const SUR = "11111111-1111-4111-8111-111111111111";

beforeEach(async () => {
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
  jest.mocked(friendActions).fetchFriends.mockResolvedValue([]);
  jest.mocked(actions).fetchTrip.mockReturnValue(new Promise(() => {}));
  jest.mocked(actions).fetchFeed.mockReturnValue(new Promise(() => {}));
  featured.fetchFeatured.mockReset().mockResolvedValue([featuredPhoto("p1"), featuredPhoto("p2", { author: CAMI })]);
  featured.unfeatureMedia.mockReset().mockResolvedValue(undefined);
  likes.likeMedia.mockReset().mockResolvedValue(undefined);
  likes.unlikeMedia.mockReset().mockResolvedValue(undefined);
});

const showcase = () => within(screen.getByTestId("profile-showcase"));
const viewer = () => within(screen.getByTestId("featured-viewer"));

async function openFromProfile(name: string) {
  await renderRouter(routes, { initialUrl: "/me" });
  await fireEvent.press(await showcase().findByRole("button", { name }));
  await screen.findByTestId("featured-viewer");
}

describe("Featured viewer", () => {
  it("pages over the profile's featured photos starting at the tapped one, with the author but no caption or roll", async () => {
    await openFromProfile("Foto de Cami");

    const pager = screen.getByTestId("featured-pager");
    expect(pager.props.data.map((p: { mediaId: string }) => p.mediaId)).toEqual(["p1", "p2"]);
    expect(pager.props.initialScrollIndex).toBe(1);
    expect(viewer().getByText("Cami")).toBeVisible();
    expect(screen.queryByText("Viaje al sur")).toBeNull();
  });

  it("a photo the owner took shows no author", async () => {
    await openFromProfile("Foto destacada");

    expect(screen.getByTestId("featured-pager").props.initialScrollIndex).toBe(0);
    expect(viewer().queryByText("Cami")).toBeNull();
    expect(viewer().queryByText("Juani")).toBeNull();
  });

  it("on your profile 'Sacar de tu perfil' removes it and the grid no longer has it", async () => {
    await openFromProfile("Foto de Cami");

    expect(viewer().getByTestId("unfeature-symbol")).toHaveProp("name", "person.crop.circle.badge.minus");
    await fireEvent.press(viewer().getByRole("button", { name: "Sacar de tu perfil" }));

    await waitFor(() => expect(screen).toHavePathname("/me"));
    expect(featured.unfeatureMedia).toHaveBeenCalledTimes(1);
    expect(featured.unfeatureMedia).toHaveBeenCalledWith("p2");
    await waitFor(() => expect(showcase().queryByRole("button", { name: "Foto de Cami" })).toBeNull());
    expect(showcase().getByRole("button", { name: "Foto destacada" })).toBeVisible();
  });

  it("shows icon-only actions, with Más opciones at the top, out of the bottom panel", async () => {
    await openFromProfile("Foto de Cami");

    const info = within(viewer().getByTestId("featured-info"));
    expect(info.getByRole("button", { name: "Me gusta" })).toBeVisible();
    expect(info.getByRole("button", { name: "Sacar de tu perfil" })).toBeVisible();
    expect(viewer().queryByText("Sacar de tu perfil")).toBeNull();
    expect(viewer().getByLabelText("Más opciones")).toBeTruthy();
    expect(info.queryByLabelText("Más opciones")).toBeNull();
    expect(info.queryByRole("menuitem")).toBeNull();
  });

  it("if removing fails it says so and keeps the photo", async () => {
    featured.unfeatureMedia.mockRejectedValue(new Error("No hay conexión"));
    await openFromProfile("Foto de Cami");

    await fireEvent.press(viewer().getByRole("button", { name: "Sacar de tu perfil" }));

    expect(await viewer().findByText("No hay conexión")).toBeVisible();
    expect(screen).toHavePathname("/featured/u1/p2");
  });

  it("tapping the author closes the viewer and opens their profile", async () => {
    await openFromProfile("Foto de Cami");

    await fireEvent.press(viewer().getByRole("button", { name: "Perfil de Cami" }));

    await waitFor(() => expect(screen).toHavePathname("/user/u2"));
    expect(screen.queryByTestId("featured-viewer")).toBeNull();
  });

  it("tapping yourself as the author on someone else's profile opens your Perfil", async () => {
    jest.mocked(friendActions).fetchFriend.mockResolvedValue({ friend: { ...CAMI, bio: null }, commonTrips: [] });
    featured.fetchFeatured.mockImplementation(async (userId) =>
      userId === "u2" ? [featuredPhoto("p2", { author: JUANI }, "u2")] : [],
    );
    await renderRouter(routes, { initialUrl: "/featured/u2/p2" });

    await fireEvent.press(await viewer().findByRole("button", { name: "Perfil de Juani" }));

    await waitFor(() => expect(screen).toHavePathname("/me"));
  });

  it("someone else's featured photos have no 'Sacar de tu perfil'", async () => {
    jest.mocked(friendActions).fetchFriend.mockResolvedValue({ friend: { ...CAMI, bio: null }, commonTrips: [] });
    featured.fetchFeatured.mockImplementation(async (userId) =>
      userId === "u2" ? [featuredPhoto("p1", {}, "u2"), featuredPhoto("p2", { author: JUANI }, "u2")] : [],
    );
    await renderRouter(routes, { initialUrl: "/featured/u2/p2" });

    await screen.findByTestId("featured-viewer");
    expect(await viewer().findByText("Juani")).toBeVisible();
    expect(viewer().queryByRole("button", { name: "Sacar de tu perfil" })).toBeNull();
  });

  describe("reporting", () => {
    let sheet: jest.SpyInstance;
    beforeEach(() => {
      moderation.reportMedia.mockReset().mockResolvedValue(undefined);
      sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_o, cb) => cb(0));
    });
    afterEach(() => sheet.mockRestore());

    it("the featured viewer reports a photo", async () => {
      await openFromProfile("Foto de Cami");

      await fireEvent.press(viewer().getByRole("menuitem", { name: "Denunciar" }));

      await waitFor(() => expect(moderation.reportMedia).toHaveBeenCalledWith("p2", "offensive"));
      await waitFor(() => expect(screen.queryByTestId("featured-viewer")).toBeNull());
    });

    it("a photo you took yourself has no Denunciar", async () => {
      await openFromProfile("Foto destacada");

      expect(viewer().queryByRole("menuitem", { name: "Denunciar" })).toBeNull();
    });
  });
});

describe("Featured viewer: likes", () => {
  const openSomeones = async (photos: ReturnType<typeof featuredPhoto>[], mediaId: string) => {
    jest.mocked(friendActions).fetchFriend.mockResolvedValue({ friend: { ...CAMI, bio: null }, commonTrips: [] });
    featured.fetchFeatured.mockImplementation(async (userId) => (userId === "u2" ? photos : []));
    await renderRouter(routes, { initialUrl: `/featured/u2/${mediaId}` });
    await screen.findByTestId("featured-viewer");
  };
  const heart = () => viewer().findByRole("button", { name: "Me gusta" });

  it("shows the heart with the count on someone else's photo, and liking adds yours", async () => {
    await openSomeones([featuredPhoto("p1", { likeCount: 4 }, "u2")], "p1");
    expect(within(await heart()).getByText("4")).toBeVisible();

    await fireEvent.press(await heart());

    await waitFor(() => expect(within(viewer().getByRole("button", { name: "Ya no me gusta" })).getByText("5")).toBeVisible());
    expect(likes.likeMedia).toHaveBeenCalledWith("p1");
  });

  it("puts it back and says why when it fails", async () => {
    likes.unlikeMedia.mockRejectedValue(new Error("No hay conexión"));
    await openSomeones([featuredPhoto("p1", { likeCount: 1, likedByMe: true }, "u2")], "p1");
    await fireEvent.press(await viewer().findByRole("button", { name: "Ya no me gusta" }));
    expect(await viewer().findByText("No hay conexión")).toBeVisible();
    expect(within(viewer().getByRole("button", { name: "Ya no me gusta" })).getByText("1")).toBeVisible();
  });

  it("double tap on the photo likes it, with no heart animation", async () => {
    await openSomeones([featuredPhoto("p1", {}, "u2")], "p1");
    await heart();
    await fireEvent.press(viewer().getByLabelText("Foto destacada"));
    await fireEvent.press(viewer().getByLabelText("Foto destacada"));

    await waitFor(() => expect(likes.likeMedia).toHaveBeenCalledWith("p1"));
    expect(screen.queryByTestId("heart-burst")).toBeNull();
    await act(async () => jest.advanceTimersByTime(300));
    expect(viewer().getByRole("button", { name: "Ya no me gusta" })).toBeVisible();
  });

  it("your own profile's photos have the heart too", async () => {
    await openFromProfile("Foto destacada");
    expect(await heart()).toBeVisible();
  });
});
