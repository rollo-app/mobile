import { router } from "expo-router";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { queryClient } from "@/api/query-client";
import * as friendActions from "@/features/friends/actions";
import * as actions from "@/features/trips/actions";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";
import * as featuredActions from "@/features/featured/actions";

jest.mock("@/features/trips/actions");
// Perfil is mounted too: nobody has featured photos, so its own "Reintentar" stays out of the way.
jest.mock("@/features/featured/actions");
beforeEach(() => {
  jest.mocked(featuredActions).fetchFeatured.mockResolvedValue([]);
});
// The Amigos tab is mounted too: its list loads fine so its own "Reintentar" stays out of the way.
jest.mock("@/features/friends/actions");
const mocked = jest.mocked(actions);

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";

const detail = (): actions.TripDetail => ({
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
    momentMode: "off",
    momentWindowStart: 540,
    momentWindowEnd: 1380,
  },
  me: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin", blockedByMe: false },
  members: [
    { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin", blockedByMe: false },
    { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null, role: "member", blockedByMe: false },
  ],
  today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 12,
});

beforeEach(() => {
  jest.mocked(friendActions).fetchFriends.mockResolvedValue([]);
  mocked.fetchTrip.mockReset();
  mocked.fetchFeed.mockResolvedValue({ revealed: false, revealAt: Date.now() + 9 * 24 * 60 * 60 * 1000, items: [] });
  return signInAs({ trips: [tripSummary(SUR, "Viaje al sur", { role: "admin" })] });
});

describe("Shared trip data", () => {
  it("the tab bar and Roll share a single request", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByText("7 de 10")).toBeVisible();
    expect(mocked.fetchTrip).toHaveBeenCalledTimes(1);
  });

  it("going back to a screen within 30 s does not request it again", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/roll" });
    await screen.findByText("7 de 10");

    await act(async () => router.navigate("/me"));
    expect(await screen.findByText("HUB5FT")).toBeVisible();
    await act(async () => router.navigate("/roll"));
    expect(await screen.findByText("7 de 10")).toBeVisible();

    expect(mocked.fetchTrip).toHaveBeenCalledTimes(1);
  });

  it("after 30 s, regaining focus requests it again", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/roll" });
    await screen.findByText("7 de 10");
    await act(async () => router.navigate("/me"));
    await screen.findByText("HUB5FT");

    const key = ["trip", SUR];
    await act(async () => {
      queryClient.setQueryData(key, detail(), { updatedAt: Date.now() - 60_000 });
      router.navigate("/roll");
    });

    await waitFor(() => expect(mocked.fetchTrip).toHaveBeenCalledTimes(2));
  });

  it("if it fails with no cache it shows the error and Reintentar requests it again", async () => {
    mocked.fetchTrip.mockRejectedValueOnce(new Error("Sin conexión. Probá de nuevo cuando tengas señal."));
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/roll" });

    // Several tabs are mounted at once, and each shows the shared error.
    expect((await screen.findAllByText("Sin conexión. Probá de nuevo cuando tengas señal."))[0]).toBeVisible();
    await fireEvent.press(screen.getAllByRole("button", { name: "Reintentar" })[0]!);

    expect(await screen.findByText("7 de 10")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(mocked.fetchTrip).toHaveBeenCalledTimes(2);
  });

  it("Roll offers Reintentar when there is no data", async () => {
    mocked.fetchTrip.mockRejectedValueOnce(new Error("Sin conexión"));
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/roll" });

    await fireEvent.press((await screen.findAllByRole("button", { name: "Reintentar" }))[0]!);

    expect(await screen.findByText("HUB5FT")).toBeVisible();
  });

  it("with saved data and no signal it shows the saved data, no error", async () => {
    queryClient.setQueryData(["trip", SUR], detail(), { updatedAt: Date.now() - 60_000 });
    mocked.fetchTrip.mockRejectedValue(new Error("Sin conexión"));
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByText("7 de 10")).toBeVisible();
    await waitFor(() => expect(mocked.fetchTrip).toHaveBeenCalled());
    expect(screen.queryByText("Sin conexión")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(screen.getByText("7 de 10")).toBeVisible();
  });
});
