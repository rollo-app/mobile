import { ActionSheetIOS } from "react-native";
import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import "@/test/reanimated";
import * as actions from "@/features/comments/actions";
import * as moderation from "@/features/moderation/actions";
import * as tripActions from "@/features/trips/actions";
import { markPresentationSeen } from "@/storage/presentation";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/comments/actions");
jest.mock("@/features/moderation/actions");
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success" },
  impactAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light" },
}));

const comments = jest.mocked(actions);
const trips = jest.mocked(tripActions);
const moderationActions = jest.mocked(moderation);

const SUR = "11111111-1111-4111-8111-111111111111";
const DAY = 24 * 60 * 60 * 1000;

const feedItem = (id: string, over: Partial<tripActions.Feed["items"][number]> = {}): tripActions.Feed["items"][number] => ({
  id,
  type: "photo",
  takenAt: Date.parse("2027-01-12T16:10:00Z"),
  day: "2027-01-12",
  lat: null,
  lng: null,
  caption: null,
  thumbhash: null,
  durationS: null,
  author: { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null },
  width: 4000,
  height: 3000,
  files: { thumb: `/m/${id}/thumb`, original: `/m/${id}/original` },
  ...over,
});

const feed = (items: tripActions.Feed["items"]): tripActions.Feed => ({ revealed: true, revealAt: Date.now() - DAY, items });

const comment = (id: string, text: string, over: Partial<actions.Comment> = {}): actions.Comment => ({
  id,
  text,
  createdAt: Date.now() - 5 * 60_000,
  author: { userId: "u-m2", name: "Fede", username: null, avatarUrl: null },
  canDelete: false,
  ...over,
});

const mine = { userId: "u1", name: "Juani", username: "juani", avatarUrl: null };

beforeEach(async () => {
  trips.fetchFeed.mockResolvedValue(feed([feedItem("a", { commentCount: 2 }), feedItem("v", { type: "video" })]));
  trips.fetchTrip.mockReturnValue(new Promise(() => {}));
  comments.fetchComments.mockReset().mockResolvedValue([]);
  comments.addComment.mockReset().mockResolvedValue(comment("new", "hola", { author: mine, canDelete: true }));
  comments.deleteComment.mockReset().mockResolvedValue(undefined);
  moderationActions.reportComment.mockReset().mockResolvedValue(undefined);
  await markPresentationSeen(SUR);
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
});

describe("Comments in the photo viewer", () => {
  it("shows a Comentarios button with the count and opens the sheet", async () => {
    comments.fetchComments.mockResolvedValue([comment("c1", "jajaja")]);
    await renderRouter(routes, { initialUrl: `/photo/a?tripId=${SUR}` });

    const button = await screen.findByRole("button", { name: "Comentarios" });
    expect(button.props.accessibilityValue).toEqual({ text: "2 comentarios" });
    await fireEvent.press(button);

    await waitFor(() => expect(screen).toHavePathname("/comments/a"));
    expect(await screen.findByText("jajaja")).toBeVisible();
  });

  it("has no Comentarios button on a video", async () => {
    await renderRouter(routes, { initialUrl: `/photo/v?tripId=${SUR}` });
    await screen.findByRole("button", { name: "Guardar en Fotos" });
    expect(screen.queryByRole("button", { name: "Comentarios" })).toBeNull();
  });

  it("opens the sheet by itself when it comes from a push (comments=1)", async () => {
    comments.fetchComments.mockResolvedValue([comment("c1", "qué buena")]);
    await renderRouter(routes, { initialUrl: `/photo/a?tripId=${SUR}&comments=1` });
    await waitFor(() => expect(screen).toHavePathname("/comments/a"));
    expect(await screen.findByText("qué buena")).toBeVisible();
  });
});

describe("Comments sheet", () => {
  const open = () => renderRouter(routes, { initialUrl: "/comments/a" });

  it("lists comments with author, text and how long ago", async () => {
    comments.fetchComments.mockResolvedValue([comment("c1", "jajaja"), comment("c2", "qué foto", { author: mine, createdAt: Date.now() - 3 * 60 * 60_000 })]);
    await open();

    expect(await screen.findByText("jajaja")).toBeVisible();
    expect(screen.getByText("Fede")).toBeVisible();
    expect(screen.getByText("hace 5 min")).toBeVisible();
    expect(screen.getByText("qué foto")).toBeVisible();
    expect(screen.getByText("hace 3 h")).toBeVisible();
    expect(comments.fetchComments).toHaveBeenCalledWith("a");
  });

  it("invites to write the first comment when there are none", async () => {
    await open();
    expect(await screen.findByText("Todavía no hay comentarios. Escribí el primero.")).toBeVisible();
  });

  it("shows a retry when the list can't load", async () => {
    comments.fetchComments.mockRejectedValueOnce(new Error("Sin conexión"));
    await open();
    expect(await screen.findByText("Sin conexión")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Todavía no hay comentarios. Escribí el primero.")).toBeVisible();
  });

  it("sends a comment, clears the field and shows it in the list", async () => {
    await open();
    await screen.findByText("Todavía no hay comentarios. Escribí el primero.");
    const field = screen.getByLabelText("Escribí un comentario");
    expect(screen.getByRole("button", { name: "Enviar" }).props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(field, "  hola  ");
    comments.fetchComments.mockResolvedValue([comment("new", "hola", { author: mine, canDelete: true })]);
    await fireEvent.press(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(comments.addComment).toHaveBeenCalledWith("a", "hola"));
    expect(await screen.findByText("hola")).toBeVisible();
    expect(screen.getByLabelText("Escribí un comentario").props.value).toBe("");
  });

  it("keeps what you wrote and shows the error under the field if sending fails", async () => {
    comments.addComment.mockRejectedValue(new Error("No se pudo comentar"));
    await open();
    await fireEvent.changeText(await screen.findByLabelText("Escribí un comentario"), "hola");
    await fireEvent.press(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("No se pudo comentar")).toBeVisible();
    expect(screen.getByLabelText("Escribí un comentario").props.value).toBe("hola");
  });

  it("limits the field to 500 characters", async () => {
    await open();
    expect((await screen.findByLabelText("Escribí un comentario")).props.maxLength).toBe(500);
  });

  it("offers Borrar only on the comments you can delete, and deletes", async () => {
    comments.fetchComments.mockResolvedValue([comment("c1", "de otro"), comment("c2", "mío", { author: mine, canDelete: true })]);
    await open();
    await screen.findByText("mío");
    expect(screen.getAllByRole("menuitem", { name: "Borrar" })).toHaveLength(1);

    comments.fetchComments.mockResolvedValue([comment("c1", "de otro")]);
    await fireEvent.press(screen.getByRole("menuitem", { name: "Borrar" }));

    await waitFor(() => expect(comments.deleteComment).toHaveBeenCalledWith("c2"));
    await waitFor(() => expect(screen.queryByText("mío")).toBeNull());
  });

  it("the photo's author can delete someone else's comment, and still report it", async () => {
    comments.fetchComments.mockResolvedValue([comment("c1", "de otro", { canDelete: true })]);
    await open();
    const row = within(await screen.findByTestId("comment-c1"));
    expect(row.getByRole("menuitem", { name: "Borrar" })).toBeTruthy();
    expect(row.getByRole("menuitem", { name: "Denunciar" })).toBeTruthy();
  });

  it("reports someone else's comment with the reason picked and hides it", async () => {
    const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_o, cb) => cb(1));
    comments.fetchComments.mockResolvedValue([comment("c1", "insulto"), comment("c2", "mío", { author: mine, canDelete: true })]);
    await open();
    await screen.findByText("mío");
    // Your own comment has no Denunciar.
    expect(screen.getAllByRole("menuitem", { name: "Denunciar" })).toHaveLength(1);

    comments.fetchComments.mockResolvedValue([comment("c2", "mío", { author: mine, canDelete: true })]);
    await fireEvent.press(screen.getByRole("menuitem", { name: "Denunciar" }));

    await waitFor(() => expect(moderationActions.reportComment).toHaveBeenCalledWith("c1", "abuse"));
    await waitFor(() => expect(screen.queryByText("insulto")).toBeNull());
    sheet.mockRestore();
  });
});
