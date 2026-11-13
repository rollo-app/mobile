import * as ImagePicker from "expo-image-picker";
import { Alert, Share } from "react-native";
import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import "@/test/reanimated";
import * as friendActions from "@/features/friends/actions";
import * as tripActions from "@/features/trips/actions";
import { queryClient } from "@/api/query-client";
import { feedKey } from "@/features/trips/use-feed";
import { ApiError } from "@/api/client";
import { setActiveTripId } from "@/storage/active-trip";
import { markPresentationSeen } from "@/storage/presentation";
import { signInAs, tripSummary } from "@/test/account";
import { keepOriginals } from "@/test/trip";
import { routes } from "@/test/routes";
import { ORGANIZER_NOTE } from "@/features/events/event-groups-section";

jest.mock("@/features/friends/actions");
jest.mock("@/features/trips/actions");
jest.mock("expo-image-manipulator", () => {
  const saved = { uri: "file:///cache/cover.jpg" };
  const ctx: Record<string, jest.Mock> = {};
  ctx.crop = jest.fn(() => ctx);
  ctx.resize = jest.fn(() => ctx);
  ctx.renderAsync = jest.fn(async () => ({ saveAsync: jest.fn(async () => saved) }));
  return { ImageManipulator: { manipulate: jest.fn(() => ctx), __ctx: ctx }, SaveFormat: { JPEG: "jpeg" } };
});
const manipulator = jest.requireMock("expo-image-manipulator") as {
  ImageManipulator: { __ctx: { crop: jest.Mock; resize: jest.Mock } };
};
const friends = jest.mocked(friendActions);
const trips = jest.mocked(tripActions);

const DAY = 24 * 60 * 60 * 1000;
const EVENT = "22222222-2222-4222-8222-222222222222";
const GROUPS = [
  { id: "g1", name: "Familia" },
  { id: "g2", name: "Amigos" },
];

type Member = tripActions.TripDetail["members"][number];
const organizer: Member = { id: "m1", userId: "u1", name: "Juani", username: "juani", avatarUrl: null, role: "admin", isCreator: true, blockedByMe: false };
const guest: Member = { id: "m2", userId: "u2", name: "Cami", username: "cami", avatarUrl: null, role: "member", isCreator: false, blockedByMe: false };

const detail = (me: Member, groupIds: string[], over: Partial<tripActions.Trip> = {}): tripActions.TripDetail => ({
  trip: {
    id: EVENT,
    name: "Casamiento de Cami",
    joinCode: "ABC123",
    timezone: "America/Argentina/Buenos_Aires",
    startsAt: Date.now() - DAY,
    endsAt: Date.now() + DAY,
    revealAt: Date.now() + DAY,
    revealed: false,
    dailyPhotoLimit: 10,
    dailyVideoLimit: 3,
    featuringDisabled: false,
    maxMembers: 50,
    photoLimitMode: "total",
    totalPhotoLimit: 20,
    momentMode: "off",
    momentWindowStart: 540,
    momentWindowEnd: 1380,
    originals: keepOriginals,
    type: "event",
    coverUrl: null,
    groups: GROUPS,
    createdBy: { userId: "u1", name: "Juani" },
    ...over,
  },
  me: { ...me, groupIds },
  members: [organizer, guest],
  today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 0,
});

/** Opens the Rollo tab and, if `row` is given, taps that row of the board to go to its screen. */
async function open(d: tripActions.TripDetail, row?: string, url = "/roll") {
  trips.fetchTrip.mockResolvedValue(d);
  await setActiveTripId(EVENT);
  await renderRouter(routes, { initialUrl: url });
  if (row) {
    // Everything but the QR lives in "Ajustes del rollo".
    if (row !== "Código QR") await fireEvent.press(await screen.findByRole("button", { name: "Ajustes del rollo" }));
    await fireEvent.press(await screen.findByRole("button", { name: row }));
  }
}

/** Opens the Rollo tab and then "Ajustes del rollo" with the gear in the header. */
async function openSettings(d: tripActions.TripDetail, url = "/roll") {
  await open(d, undefined, url);
  await fireEvent.press(await screen.findByRole("button", { name: "Ajustes del rollo" }));
  await screen.findByText("Fechas");
}

let alert: jest.SpyInstance;
let prompt: jest.SpyInstance;

beforeEach(async () => {
  for (const mock of [...Object.values(friends), ...Object.values(trips)]) (mock as Partial<jest.Mock>).mockReset?.();
  const summary = tripSummary(EVENT, "Casamiento de Cami", { type: "event" });
  await signInAs({ trips: [summary] });
  trips.fetchMyTrips.mockResolvedValue({ trips: [summary] });
  trips.fetchFeedPage.mockResolvedValue({ revealed: false, revealAt: Date.now() + DAY, items: [], nextCursor: null });
  friends.fetchFriends.mockResolvedValue([]);
  friends.fetchFriendRequests.mockResolvedValue([]);
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  prompt = jest.spyOn(Alert, "prompt").mockImplementation(() => {});
});
afterEach(() => {
  alert.mockRestore();
  prompt.mockRestore();
});

describe("Event board", () => {
  it("an organizer sees Código QR and Grupos and no Sumar amigos", async () => {
    await open(detail(organizer, []));
    expect(await screen.findByRole("button", { name: "Código QR" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Sumar amigos" })).toBeNull();
    expect(screen.queryByText("Grupos")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Ajustes del rollo" }));
    expect(await screen.findByText("Grupos")).toBeVisible();
    expect(screen.getByText("Familia")).toBeVisible();
    expect(screen.getByText("Amigos")).toBeVisible();
    expect(screen.getByRole("button", { name: "Elegir portada" })).toBeVisible();
    expect(screen.getByText(ORGANIZER_NOTE)).toBeVisible();
  });

  it("a guest sees their groups and Sumarme a otro grupo, and no Código QR", async () => {
    await openSettings(detail(guest, ["g2"]));
    expect(await screen.findByText("Grupos")).toBeVisible();
    expect(screen.getByText("Amigos")).toBeVisible();
    expect(screen.queryByText("Familia")).toBeNull();
    expect(screen.getByRole("button", { name: "Sumarme a otro grupo" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Elegir portada" })).toBeNull();
    expect(screen.queryByText(ORGANIZER_NOTE)).toBeNull();
  });

  it("hides group management and the cover row after the reveal", async () => {
    await markPresentationSeen(EVENT);
    await openSettings(detail(organizer, [], { revealed: true, coverUrl: "/covers/x/y.jpg" }), "/roll?view=roll");
    expect(await screen.findByText("Grupos")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Administrar grupos" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cambiar portada" })).toBeNull();
  });

  it("hides Código QR once the event is revealed", async () => {
    await markPresentationSeen(EVENT);
    await open(detail(organizer, [], { revealed: true }), undefined, "/roll?view=roll");
    expect(await screen.findByRole("button", { name: /^Código .*Compartir invitación$/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Código QR" })).toBeNull();
  });

  it("shares the join link of an event", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction", activityType: undefined });
    await open(detail(guest, ["g1"]));
    await fireEvent.press(await screen.findByRole("button", { name: /^Código .*Compartir invitación$/ }));
    expect(share).toHaveBeenCalledWith({ message: expect.stringContaining("https://rolloproject.com/join/ABC123") });
    share.mockRestore();
  });

  it("a regular trip keeps Sumar amigos and has no Grupos", async () => {
    await open({ ...detail(organizer, []), trip: { ...detail(organizer, []).trip, type: "trip", groups: [] } });
    expect(await screen.findByRole("button", { name: "Sumar amigos" })).toBeVisible();
    expect(screen.queryByText("Grupos")).toBeNull();
    expect(screen.queryByRole("button", { name: "Código QR" })).toBeNull();
  });
});

describe("Cover hero", () => {
  it("shows the cover big at the top of the board with the event's name and day", async () => {
    await open(detail(guest, ["g1"], { coverUrl: "/covers/x/y.jpg", startsAt: Date.parse("2026-12-12T21:00:00Z") }));
    const hero = await screen.findByTestId("event-hero");
    expect(within(hero).getByText("Casamiento de Cami")).toBeVisible();
    expect(within(hero).getByText("12 de diciembre")).toBeVisible();
  });

  it("has no hero without a cover", async () => {
    await openSettings(detail(organizer, []));
    expect(await screen.findByRole("button", { name: "Elegir portada" })).toBeVisible();
    expect(screen.queryByTestId("event-hero")).toBeNull();
  });
});

describe("Cover (organizer)", () => {
  it("picks a photo from the library and uploads it as the cover", async () => {
    const pick = jest.spyOn(ImagePicker, "launchImageLibraryAsync").mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///p.jpg", width: 4000, height: 3000 }],
    } as ImagePicker.ImagePickerResult);
    trips.uploadCover.mockResolvedValue("/covers/x/y.jpg");
    await open(detail(organizer, []), "Elegir portada");
    // The crop screen lets the organizer frame the square; Elegir uploads that square (at most 1600 px).
    await waitFor(() => expect(screen).toHavePathname("/crop-cover"));
    expect(trips.uploadCover).not.toHaveBeenCalled();
    await fireEvent.press(await screen.findByRole("button", { name: "Elegir" }));
    await waitFor(() => expect(trips.uploadCover).toHaveBeenCalledWith(EVENT, { uri: "file:///cache/cover.jpg", width: 1600, height: 1600 }));
    expect(manipulator.ImageManipulator.__ctx.crop).toHaveBeenLastCalledWith({ originX: 500, originY: 0, width: 3000, height: 3000 });
    expect(manipulator.ImageManipulator.__ctx.resize).toHaveBeenLastCalledWith({ width: 1600, height: 1600 });
    pick.mockRestore();
  });

  it("cancelling the crop uploads nothing", async () => {
    const pick = jest.spyOn(ImagePicker, "launchImageLibraryAsync").mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///p.jpg", width: 4000, height: 3000 }],
    } as ImagePicker.ImagePickerResult);
    await open(detail(organizer, []), "Elegir portada");
    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen).toHavePathname("/roll-settings"));
    expect(trips.uploadCover).not.toHaveBeenCalled();
    pick.mockRestore();
  });

  it("shows the upload error inline", async () => {
    const pick = jest.spyOn(ImagePicker, "launchImageLibraryAsync").mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///p.jpg", width: 4000, height: 3000 }],
    } as ImagePicker.ImagePickerResult);
    trips.uploadCover.mockRejectedValue(new ApiError(409, "Este evento ya se reveló."));
    await open(detail(organizer, []), "Elegir portada");
    await fireEvent.press(await screen.findByRole("button", { name: "Elegir" }));
    expect(await screen.findByText("Este evento ya se reveló.")).toBeVisible();
    pick.mockRestore();
  });
});

describe("Groups (organizer)", () => {
  const save = () => (prompt.mock.calls[0]![2] as { text: string; onPress?: (t: string) => void }[]).find((b) => b.text === "Guardar")!;

  it("adds a group", async () => {
    trips.createGroup.mockResolvedValue({ id: "g3", name: "Trabajo" });
    await open(detail(organizer, []), "Administrar grupos");
    await fireEvent.press(await screen.findByRole("button", { name: "Agregar grupo" }));
    save().onPress!("  Trabajo ");
    await waitFor(() => expect(trips.createGroup).toHaveBeenCalledWith(EVENT, "Trabajo"));
  });

  it("renames a group", async () => {
    trips.renameGroup.mockResolvedValue({ id: "g1", name: "Primos" });
    await open(detail(organizer, []), "Administrar grupos");
    await fireEvent.press(await screen.findByRole("button", { name: "Familia" }));
    save().onPress!("Primos");
    await waitFor(() => expect(trips.renameGroup).toHaveBeenCalledWith(EVENT, "g1", "Primos"));
  });

  it("deleting a group with people shows the server message", async () => {
    trips.deleteGroup.mockRejectedValue(new ApiError(409, "Este grupo tiene gente o fotos."));
    await open(detail(organizer, []), "Administrar grupos");
    await fireEvent.press(await screen.findByRole("button", { name: "Borrar Familia" }));
    const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === "Borrar")!.onPress!();
    expect(await screen.findByText("Este grupo tiene gente o fotos.")).toBeVisible();
    expect(trips.deleteGroup).toHaveBeenCalledWith(EVENT, "g1");
  });
});

describe("Sumarme a otro grupo (guest)", () => {
  it("saves the chosen groups", async () => {
    trips.setMyGroups.mockResolvedValue(["g1", "g2"]);
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");
    await open(detail(guest, ["g2"]), "Sumarme a otro grupo");
    await fireEvent.press(await screen.findByRole("button", { name: "Familia" }));
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(trips.setMyGroups).toHaveBeenCalledWith(EVENT, ["g2", "g1"]));
    // Groups decide which photos you see: the feed (both orders) is refetched.
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: feedKey(EVENT) }));
  });

  it("shows the server message when the event was revealed meanwhile", async () => {
    trips.setMyGroups.mockRejectedValue(new ApiError(409, "Este evento ya se reveló."));
    await open(detail(guest, ["g2"]), "Sumarme a otro grupo");
    await fireEvent.press(await screen.findByRole("button", { name: "Familia" }));
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Este evento ya se reveló.")).toBeVisible();
  });
});

describe("Código QR", () => {
  it("the QR screen shows the code under the QR", async () => {
    await open(detail(organizer, []), "Código QR");
    expect(await screen.findByText("Casamiento de Cami")).toBeVisible();
    expect(screen.getByText("ABC123")).toBeVisible();
    expect(screen.getByRole("button", { name: "Compartir" })).toBeVisible();
  });
});
