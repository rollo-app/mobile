import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { queryClient } from "@/api/query-client";
import * as activityActions from "@/features/activity/actions";
import type { LikedPhoto } from "@/features/activity/actions";
import * as featuredActions from "@/features/featured/actions";
import * as friendActions from "@/features/friends/actions";
import * as likeActions from "@/features/likes/actions";
import * as actions from "@/features/trips/actions";
import { signInAs, tripSummary } from "@/test/account";
import { CAMI, featuredPhoto } from "@/test/featured";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/friends/actions");
jest.mock("@/features/featured/actions");
jest.mock("@/features/likes/actions");
jest.mock("@/features/activity/actions");
const activity = jest.mocked(activityActions);
const likes = jest.mocked(likeActions);
const featured = jest.mocked(featuredActions);

const SUR = "11111111-1111-4111-8111-111111111111";

const liked = (mediaId: string, over: Partial<LikedPhoto> = {}): LikedPhoto => ({
  mediaId,
  likedAt: 1_000,
  authorUserId: "u1",
  author: { id: "u1", name: "Juani", username: "juani", avatarUrl: null },
  thumbPath: `/trips/${SUR}/media/${mediaId}/thumb`,
  thumbHash: null,
  source: { kind: "trip", tripId: SUR },
  ...over,
});
const comment = (commentId: string, over: Partial<activityActions.MyComment> = {}): activityActions.MyComment => ({
  commentId,
  mediaId: `m-${commentId}`,
  tripId: SUR,
  text: "Qué día",
  createdAt: Date.now() - 5 * 60_000,
  thumbPath: `/trips/${SUR}/media/m-${commentId}/thumb`,
  thumbHash: null,
  ...over,
});
const featuredBy = (mediaId: string, over: Partial<activityActions.FeaturedByItem> = {}): activityActions.FeaturedByItem => ({
  mediaId,
  user: { ...CAMI, bio: null },
  featuredAt: Date.now() - 2 * 3_600_000,
  thumbPath: `/featured/u2/${mediaId}/thumb`,
  thumbHash: null,
  ...over,
});
const page = (items: LikedPhoto[], over: Partial<activityActions.MyLikes> = {}) => ({ items, nextCursor: null, total: items.length, ...over });

beforeEach(async () => {
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
  jest.mocked(friendActions).fetchFriends.mockResolvedValue([]);
  jest.mocked(actions).fetchTrip.mockReturnValue(new Promise(() => {}));
  jest.mocked(actions).fetchFeed.mockReturnValue(new Promise(() => {}));
  featured.fetchFeatured.mockReset().mockResolvedValue([]);
  likes.unlikeMedia.mockReset().mockResolvedValue(undefined);
  activity.fetchMyLikes.mockReset().mockResolvedValue(page([liked("p1"), liked("p2", { author: CAMI, authorUserId: CAMI.id })]));
  activity.fetchMyComments.mockReset().mockResolvedValue({ items: [comment("c1"), comment("c2")], nextCursor: null, total: 2 });
  activity.fetchFeaturedBy.mockReset().mockResolvedValue({ items: [featuredBy("p1")], nextCursor: null, total: 1 });
});

afterEach(() => queryClient.clear());

describe("Tu actividad", () => {
  it("opens from the Perfil toolbar and lists Me gusta with how many", async () => {
    await renderRouter(routes, { initialUrl: "/me" });

    await fireEvent.press(await screen.findByRole("button", { name: "Tu actividad" }));

    await waitFor(() => expect(screen).toHavePathname("/me/activity"));
    expect(await screen.findByRole("button", { name: /^Me gusta, 2/ })).toBeVisible();
  });

  it("lists Comentarios and Destacaron tus fotos with their counts and opens each", async () => {
    await renderRouter(routes, { initialUrl: "/me/activity" });

    await fireEvent.press(await screen.findByRole("button", { name: /^Comentarios, 2/ }));
    await waitFor(() => expect(screen).toHavePathname("/me/comments"));
  });

  it("opens Destacaron tus fotos with its count", async () => {
    await renderRouter(routes, { initialUrl: "/me/activity" });

    await fireEvent.press(await screen.findByRole("button", { name: /^Destacaron tus fotos, 1/ }));
    await waitFor(() => expect(screen).toHavePathname("/me/featured-by"));
  });

  it("shows no count until it is known", async () => {
    activity.fetchMyLikes.mockReturnValue(new Promise(() => {}));
    await renderRouter(routes, { initialUrl: "/me/activity" });

    expect(await screen.findByRole("button", { name: "Me gusta" })).toBeVisible();
  });
});

describe("Me gusta", () => {
  it("shows the liked photos with the author's badge only on other people's", async () => {
    await renderRouter(routes, { initialUrl: "/me/likes" });

    expect(await screen.findByRole("button", { name: "Foto tuya" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Foto de Cami" })).toBeVisible();
    expect(screen.getAllByTestId("featured-author")).toHaveLength(1);
  });

  it("is empty with a message", async () => {
    activity.fetchMyLikes.mockResolvedValue(page([]));
    await renderRouter(routes, { initialUrl: "/me/likes" });

    expect(await screen.findByText("Todavía no te gustó ninguna foto.")).toBeVisible();
  });

  it("shows the error with a retry that loads again", async () => {
    activity.fetchMyLikes.mockRejectedValueOnce(new Error("Sin conexión"));
    await renderRouter(routes, { initialUrl: "/me/likes" });

    expect(await screen.findByText("Sin conexión")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("button", { name: "Foto tuya" })).toBeVisible();
  });

  it("asks for the next page with the cursor when it reaches the end", async () => {
    activity.fetchMyLikes
      .mockReset()
      .mockResolvedValueOnce(page([liked("p1")], { nextCursor: "c1", total: 2 }))
      .mockResolvedValueOnce(page([liked("p2", { likedAt: 500 })], { total: 2 }));
    await renderRouter(routes, { initialUrl: "/me/likes" });
    await screen.findByRole("button", { name: "Foto tuya" });

    await fireEvent(screen.getByTestId("my-likes-grid"), "endReached");

    await waitFor(() => expect(screen.getAllByRole("button", { name: "Foto tuya" })).toHaveLength(2));
    expect(activity.fetchMyLikes).toHaveBeenLastCalledWith("c1");
  });

  it("opens the gallery viewer for a photo of your roll", async () => {
    await renderRouter(routes, { initialUrl: "/me/likes" });

    await fireEvent.press(await screen.findByRole("button", { name: "Foto tuya" }));

    await waitFor(() => expect(screen).toHavePathname("/photo/p1"));
    expect(screen).toHaveSearchParams({ id: "p1", tripId: SUR });
  });

  it("opens the featured viewer for a photo you only see on a profile", async () => {
    activity.fetchMyLikes.mockResolvedValue(
      page([liked("p9", { authorUserId: "u2", author: { ...CAMI }, source: { kind: "featured", userId: "u3" }, thumbPath: "/featured/u3/p9/thumb" })]),
    );
    featured.fetchFeatured.mockResolvedValue([featuredPhoto("p9", { author: CAMI }, "u3")]);
    await renderRouter(routes, { initialUrl: "/me/likes" });

    await fireEvent.press(await screen.findByRole("button", { name: "Foto de Cami" }));

    await waitFor(() => expect(screen).toHavePathname("/featured/u3/p9"));
  });

  it("refreshes the list when you take a like away", async () => {
    featured.fetchFeatured.mockResolvedValue([featuredPhoto("p9", { author: CAMI, likedByMe: true, likeCount: 1 }, "u3")]);
    activity.fetchMyLikes.mockResolvedValue(
      page([liked("p9", { authorUserId: "u2", author: { ...CAMI }, source: { kind: "featured", userId: "u3" } })]),
    );
    await renderRouter(routes, { initialUrl: "/me/likes" });
    await fireEvent.press(await screen.findByRole("button", { name: "Foto de Cami" }));
    await screen.findByTestId("featured-viewer");
    activity.fetchMyLikes.mockClear().mockResolvedValue(page([]));

    await fireEvent.press(await screen.findByRole("button", { name: "Ya no me gusta" }));

    await waitFor(() => expect(activity.fetchMyLikes).toHaveBeenCalledWith(undefined));
  });
});

describe("Comentarios", () => {
  it("lists your comments with the text and how long ago", async () => {
    await renderRouter(routes, { initialUrl: "/me/comments" });

    expect(await screen.findAllByRole("button", { name: "Qué día, hace 5 min" })).toHaveLength(2);
    expect(screen.getAllByText("hace 5 min")).toHaveLength(2);
  });

  it("opens the photo with its comments open", async () => {
    await renderRouter(routes, { initialUrl: "/me/comments" });

    await fireEvent.press((await screen.findAllByRole("button", { name: "Qué día, hace 5 min" }))[0]!);

    await waitFor(() => expect(screen).toHavePathname("/photo/m-c1"));
    expect(screen).toHaveSearchParams({ id: "m-c1", tripId: SUR, comments: "1" });
  });

  it("is empty with a message", async () => {
    activity.fetchMyComments.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    await renderRouter(routes, { initialUrl: "/me/comments" });

    expect(await screen.findByText("Todavía no comentaste ninguna foto.")).toBeVisible();
  });

  it("shows the error with a retry that loads again", async () => {
    activity.fetchMyComments.mockRejectedValueOnce(new Error("Sin conexión"));
    await renderRouter(routes, { initialUrl: "/me/comments" });

    expect(await screen.findByText("Sin conexión")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findAllByRole("button", { name: /Qué día/ })).toHaveLength(2);
  });

  it("asks for the next page with the cursor when it reaches the end", async () => {
    activity.fetchMyComments
      .mockReset()
      .mockResolvedValueOnce({ items: [comment("c1")], nextCursor: "c1", total: 2 })
      .mockResolvedValueOnce({ items: [comment("c2")], nextCursor: null, total: 2 });
    await renderRouter(routes, { initialUrl: "/me/comments" });
    await screen.findAllByRole("button", { name: /Qué día/ });

    await fireEvent(screen.getByTestId("my-comments-list"), "endReached");

    await waitFor(() => expect(screen.getAllByRole("button", { name: /Qué día/ })).toHaveLength(2));
    expect(activity.fetchMyComments).toHaveBeenLastCalledWith("c1");
  });
});

describe("Destacaron tus fotos", () => {
  it("lists who featured your photos and how long ago", async () => {
    await renderRouter(routes, { initialUrl: "/me/featured-by" });

    expect(await screen.findByRole("button", { name: "Cami destacó tu foto, hace 2 h" })).toBeVisible();
    expect(screen.getByText("Cami destacó tu foto")).toBeVisible();
    expect(screen.getByText("hace 2 h")).toBeVisible();
  });

  it("opens the photo on that person's profile", async () => {
    featured.fetchFeatured.mockResolvedValue([featuredPhoto("p1", {}, "u2")]);
    await renderRouter(routes, { initialUrl: "/me/featured-by" });

    await fireEvent.press(await screen.findByRole("button", { name: /^Cami destacó tu foto/ }));

    await waitFor(() => expect(screen).toHavePathname("/featured/u2/p1"));
  });

  it("is empty with a message", async () => {
    activity.fetchFeaturedBy.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    await renderRouter(routes, { initialUrl: "/me/featured-by" });

    expect(await screen.findByText("Nadie destacó tus fotos todavía.")).toBeVisible();
  });

  it("shows the error with a retry that loads again", async () => {
    activity.fetchFeaturedBy.mockRejectedValueOnce(new Error("Sin conexión"));
    await renderRouter(routes, { initialUrl: "/me/featured-by" });

    expect(await screen.findByText("Sin conexión")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("button", { name: /^Cami destacó tu foto/ })).toBeVisible();
  });

  it("asks for the next page with the cursor when it reaches the end", async () => {
    activity.fetchFeaturedBy
      .mockReset()
      .mockResolvedValueOnce({ items: [featuredBy("p1")], nextCursor: "c1", total: 2 })
      .mockResolvedValueOnce({ items: [featuredBy("p2")], nextCursor: null, total: 2 });
    await renderRouter(routes, { initialUrl: "/me/featured-by" });
    await screen.findByRole("button", { name: /^Cami destacó tu foto/ });

    await fireEvent(screen.getByTestId("featured-by-list"), "endReached");

    await waitFor(() => expect(screen.getAllByRole("button", { name: /^Cami destacó tu foto/ })).toHaveLength(2));
    expect(activity.fetchFeaturedBy).toHaveBeenLastCalledWith("c1");
  });
});
