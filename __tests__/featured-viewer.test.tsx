import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import * as featuredActions from "@/features/featured/actions";
import * as friendActions from "@/features/friends/actions";
import * as actions from "@/features/trips/actions";
import { signInAs, tripSummary } from "@/test/account";
import { CAMI, featuredPhoto, JUANI } from "@/test/featured";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/friends/actions");
jest.mock("@/features/featured/actions");
const featured = jest.mocked(featuredActions);

const SUR = "11111111-1111-4111-8111-111111111111";

beforeEach(async () => {
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
  jest.mocked(friendActions).fetchFriends.mockResolvedValue([]);
  jest.mocked(actions).fetchTrip.mockReturnValue(new Promise(() => {}));
  jest.mocked(actions).fetchFeed.mockReturnValue(new Promise(() => {}));
  featured.fetchFeatured.mockReset().mockResolvedValue([featuredPhoto("p1"), featuredPhoto("p2", { author: CAMI })]);
  featured.unfeatureMedia.mockReset().mockResolvedValue(undefined);
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

    await fireEvent.press(viewer().getByRole("button", { name: "Sacar de tu perfil" }));

    await waitFor(() => expect(screen).toHavePathname("/me"));
    expect(featured.unfeatureMedia).toHaveBeenCalledTimes(1);
    expect(featured.unfeatureMedia).toHaveBeenCalledWith("p2");
    await waitFor(() => expect(showcase().queryByRole("button", { name: "Foto de Cami" })).toBeNull());
    expect(showcase().getByRole("button", { name: "Foto destacada" })).toBeVisible();
  });

  it("if removing fails it says so and keeps the photo", async () => {
    featured.unfeatureMedia.mockRejectedValue(new Error("No hay conexión"));
    await openFromProfile("Foto de Cami");

    await fireEvent.press(viewer().getByRole("button", { name: "Sacar de tu perfil" }));

    expect(await viewer().findByText("No hay conexión")).toBeVisible();
    expect(screen).toHavePathname("/featured/u1/p2");
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
});
