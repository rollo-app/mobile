import * as Notifications from "expo-notifications";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import "@/test/reanimated";
import { Linking, Text } from "react-native";
import { router } from "expo-router";
import { signIn } from "@/features/auth/session";
import * as friendActions from "@/features/friends/actions";
import * as pushActions from "@/features/notifications/actions";
import * as actions from "@/features/trips/actions";
import { getActiveTripId } from "@/storage/active-trip";
import { hasSeenPushPrimer, markPushPrimerSeen } from "@/storage/push-primer";
import { clearSessionToken } from "@/storage/session";
import { signInAs, tripSummary, USER } from "@/test/account";
import { routes } from "@/test/routes";
import { syncMoments } from "@/features/moments/moment-sync";
import { queryClient } from "@/api/query-client";

jest.mock("@/features/trips/actions");
jest.mock("@/features/notifications/actions");
jest.mock("@/features/friends/actions");
jest.mock("@/features/moments/moment-sync", () => ({
  ...jest.requireActual("@/features/moments/moment-sync"),
  syncMoments: jest.fn().mockResolvedValue(undefined),
}));

const trips = jest.mocked(actions);
const push = jest.mocked(pushActions);
const friends = jest.mocked(friendActions);
const notifications = jest.mocked(Notifications);

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";
const TOKEN = "ExponentPushToken[test-token]";

const detail = (id = SUR, name = "Viaje al sur"): actions.TripDetail => ({
  trip: {
    id,
    name,
    joinCode: "HUB5FT",
    timezone: "America/Argentina/Buenos_Aires",
    startsAt: Date.now() + DAY,
    endsAt: Date.now() + 3 * DAY,
    revealAt: Date.now() + 4 * DAY,
    revealed: false,
    dailyPhotoLimit: 10,
    dailyVideoLimit: 3,
    featuringDisabled: false,
    photoLimitMode: "daily",
    totalPhotoLimit: null,
    momentMode: "off",
    momentWindowStart: 540,
    momentWindowEnd: 1380,
    createdBy: null,
  },
  me: { id: "m1", userId: "u1", name: "Juani", username: "juani", avatarUrl: null, role: "admin", isCreator: false, blockedByMe: false },
  members: [],
  today: { date: "2027-01-12", photosLeft: 10, videosLeft: 3 },
  totalUploaded: 0,
});

const testRoutes = { ...routes, "user/[id]": () => <Text>Perfil de alguien</Text>, "photo/[id]": () => <Text>Foto</Text> };

const permission = (granted: boolean, canAskAgain: boolean, status: string) =>
  notifications.getPermissionsAsync.mockResolvedValue({ granted, canAskAgain, status } as never);
// Each push has its own id: one already opened is never opened again.
const tapped = (url: string, identifier = `n-${url}`) =>
  ({ actionIdentifier: "expo.modules.notifications.actions.DEFAULT", notification: { request: { identifier, content: { data: { url } } } } }) as never;

beforeEach(async () => {
  jest.clearAllMocks();
  trips.fetchTrip.mockImplementation(async (id: string) => (id === OTRO ? detail(OTRO, "Bariloche") : detail()));
  trips.joinTrip.mockResolvedValue(detail().trip);
  trips.fetchFeed.mockResolvedValue({ revealed: false, revealAt: Date.now() + 4 * DAY, items: [] } as never);
  push.registerPushToken.mockResolvedValue();
  trips.fetchMyTrips.mockResolvedValue({ trips: [tripSummary(SUR, "Viaje al sur"), tripSummary(OTRO, "Bariloche")] });
  friends.fetchFriends.mockResolvedValue([]);
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur"), tripSummary(OTRO, "Bariloche")], active: SUR });
});

afterEach(() => {
  permission(false, true, "undetermined");
  notifications.getLastNotificationResponseAsync.mockResolvedValue(null);
});

// Lets the async handlers (keychain reads, navigation) finish so nothing leaks into the next test.
const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });

describe("push token", () => {
  it("is registered when the app opens signed in with permission", async () => {
    permission(true, true, "granted");
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    await waitFor(() => expect(push.registerPushToken).toHaveBeenCalledWith(TOKEN));
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("without permission nothing is asked or sent", async () => {
    await renderRouter(testRoutes, { initialUrl: "/roll" });
    await screen.findAllByLabelText(/cambiar de rollo$/);
    await settle();

    expect(push.registerPushToken).not.toHaveBeenCalled();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("signed out, nothing is registered", async () => {
    permission(true, true, "granted");
    await clearSessionToken();
    await renderRouter(testRoutes, { initialUrl: "/" });
    await settle();

    expect(push.registerPushToken).not.toHaveBeenCalled();
  });
});

async function join() {
  await renderRouter(testRoutes, { initialUrl: "/join" });
  await fireEvent.changeText(await screen.findByLabelText("Código del rollo"), "HUB5FT");
  await waitFor(() => expect(screen.getByRole("button", { name: "Unirme" })).toBeEnabled());
  await fireEvent.press(screen.getByRole("button", { name: "Unirme" }));
  await waitFor(() => expect(trips.joinTrip).toHaveBeenCalled());
}

describe("permission primer", () => {
  it("after joining, with the permission never asked, explains first and asks only on 'Activar'", async () => {
    await join();

    expect(await screen.findByText("¿Te avisamos cuando arranque y cuando se revele?")).toBeVisible();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(await hasSeenPushPrimer()).toBe(true);

    permission(true, true, "granted");
    await fireEvent.press(screen.getByRole("button", { name: "Activar" }));

    await waitFor(() => expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(push.registerPushToken).toHaveBeenCalledWith(TOKEN));
    await waitFor(() => expect(screen).toHavePathname("/roll"));
  });

  it("'Ahora no' asks nothing", async () => {
    await join();
    await fireEvent.press(await screen.findByRole("button", { name: "Ahora no" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("once shown, it isn't shown again", async () => {
    await markPushPrimerSeen();
    await join();
    await waitFor(() => expect(screen).toHavePathname("/roll"));
    await settle();

    expect(screen.queryByText("¿Te avisamos cuando arranque y cuando se revele?")).toBeNull();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("with the permission denied, nothing is shown or asked", async () => {
    permission(false, false, "denied");
    await join();
    await waitFor(() => expect(screen).toHavePathname("/roll"));
    await settle();

    expect(screen.queryByText("¿Te avisamos cuando arranque y cuando se revele?")).toBeNull();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("with the permission already granted, registers silently without the primer", async () => {
    permission(true, true, "granted");
    await join();
    await waitFor(() => expect(screen).toHavePathname("/roll"));
    await settle();

    expect(screen.queryByText("¿Te avisamos cuando arranque y cuando se revele?")).toBeNull();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(push.registerPushToken).toHaveBeenCalledWith(TOKEN);
  });

  it("after creating a roll with friends, the primer comes first and then 'Sumar amigos'", async () => {
    friends.fetchFriends.mockResolvedValue([{ id: "u2", name: "Cami", username: "cami", avatarUrl: null }] as never);
    trips.createTrip.mockResolvedValue(detail().trip as never);
    await renderRouter(testRoutes, { initialUrl: "/create" });

    await fireEvent.changeText(await screen.findByPlaceholderText("Nombre del rollo"), "Bariloche");
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear" })).toBeEnabled());
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    await fireEvent.press(await screen.findByRole("button", { name: "Ahora no" }));
    await waitFor(() => expect(screen).toHavePathname("/add-friends"));
  });

  it("after creating a roll with friends, swiping the primer away still opens 'Sumar amigos'", async () => {
    friends.fetchFriends.mockResolvedValue([{ id: "u2", name: "Cami", username: "cami", avatarUrl: null }] as never);
    trips.createTrip.mockResolvedValue(detail().trip as never);
    await renderRouter(testRoutes, { initialUrl: "/create" });

    await fireEvent.changeText(await screen.findByPlaceholderText("Nombre del rollo"), "Bariloche");
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear" })).toBeEnabled());
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));
    await screen.findByRole("button", { name: "Ahora no" });

    // A swipe down on the native sheet pops it without touching its buttons.
    await act(async () => router.back());

    await waitFor(() => expect(screen).toHavePathname("/add-friends"));
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe("tapping a push", () => {
  it("opened from a closed app, goes to its url once the account is ready", async () => {
    notifications.getLastNotificationResponseAsync.mockResolvedValue(tapped("/user/u2"));
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    await waitFor(() => expect(screen).toHavePathname("/user/u2"));
    expect(notifications.clearLastNotificationResponseAsync).toHaveBeenCalled();
  });

  it("a roll's push makes that roll the active one and opens its tab", async () => {
    notifications.getLastNotificationResponseAsync.mockResolvedValue(tapped(`/roll?trip=${OTRO}`));
    await renderRouter(testRoutes, { initialUrl: "/me" });

    await waitFor(async () => expect(await getActiveTripId()).toBe(OTRO));
    await waitFor(() => expect(screen).toHavePathname("/roll"));
    await settle();
  });

  it("with the app open, a tap goes to its url (a photo leaves its roll active)", async () => {
    await renderRouter(testRoutes, { initialUrl: "/roll" });
    await screen.findAllByLabelText(/cambiar de rollo$/);
    const listener = notifications.addNotificationResponseReceivedListener.mock.calls.at(-1)![0];

    await act(async () => listener(tapped(`/photo/m1?tripId=${OTRO}`)));

    await waitFor(() => expect(screen).toHavePathname("/photo/m1"));
    expect(await getActiveTripId()).toBe(OTRO);
  });

  it("the 'momentPosted' push opens the viewer on that moment of a roll that is not revealed yet, and leaves its roll active", async () => {
    trips.fetchFeed.mockImplementation(async (id: string) => ({
      revealed: false,
      revealAt: Date.now() + 4 * DAY,
      items:
        id === OTRO
          ? [
              {
                id: "mo1",
                type: "photo",
                takenAt: Date.parse("2027-01-12T16:10:00Z"),
                day: "2027-01-12",
                lat: null,
                lng: null,
                caption: null,
                thumbhash: null,
                durationS: null,
                momentDay: "2027-01-12",
                author: { id: "m2", userId: "u2", name: "Fede", username: null, avatarUrl: null },
                width: 1080,
                height: 1440,
                files: { thumb: "/m/mo1/thumb", original: "/m/mo1/original" },
                selfie: { id: "se1", width: 1080, height: 1440, thumbhash: null, files: { thumb: "/m/se1/thumb", original: "/m/se1/original" } },
              },
            ]
          : [],
    }) as never);
    await renderRouter(routes, { initialUrl: "/roll" });
    await screen.findAllByLabelText(/cambiar de rollo$/);
    const listener = notifications.addNotificationResponseReceivedListener.mock.calls.at(-1)![0];

    await act(async () => listener(tapped(`/photo/mo1?tripId=${OTRO}`)));

    await waitFor(() => expect(screen).toHavePathname("/photo/mo1"));
    expect(await screen.findByTestId("viewer-info")).toBeVisible();
    expect(await screen.findByRole("button", { name: "Ver la otra foto" })).toBeVisible();
    expect(await getActiveTripId()).toBe(OTRO);
  });

  it("a moment's local notification makes its roll active and opens /moment with its day and time", async () => {
    const at = Date.now();
    notifications.getLastNotificationResponseAsync.mockResolvedValue(
      tapped(`/moment?trip=${OTRO}&day=2027-01-12&at=${at}`, `moment.${OTRO}.2027-01-12`),
    );
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    await waitFor(() => expect(screen).toHavePathname("/moment"));
    expect(screen).toHaveSearchParams({ trip: OTRO, day: "2027-01-12", at: String(at) });
    expect(await getActiveTripId()).toBe(OTRO);
    await settle();
  });

  it("signed out it waits for the login, then opens", async () => {
    await clearSessionToken();
    queryClient.clear();
    notifications.getLastNotificationResponseAsync.mockResolvedValue(tapped("/user/u2", "signed-out"));
    await renderRouter(testRoutes, { initialUrl: "/" });
    await settle();
    expect(screen).not.toHavePathname("/user/u2");

    queryClient.setQueryData(["me"], USER);
    await act(async () => signIn("session-token", "u1"));

    await waitFor(() => expect(screen).toHavePathname("/user/u2"));
  });
});

describe("Ajustes: Notificaciones", () => {
  const ALL_ON = { addedToTrip: true, newFriend: true, tripStarted: true, tripRevealed: true, photoFeatured: true, photoLiked: true, photoCommented: true, friendRequest: true, dailyMoment: true, momentPosted: true };
  const LABELS = ["Te suman a un rollo", "Nuevos amigos", "Arranca un rollo", "Se revela un rollo", "Destacan tu foto", "Les gusta tu foto", "Comentan tu foto", "Solicitudes de amistad", "Momento del día", "Momentos del grupo"];

  beforeEach(() => {
    push.fetchNotificationSettings.mockResolvedValue(ALL_ON);
    push.updateNotificationSettings.mockImplementation(async (patch) => ({ ...ALL_ON, ...patch }));
  });

  it("the row 'Notificaciones' in Ajustes comes right after 'Editar perfil' and opens the screen", async () => {
    permission(true, true, "granted");
    await renderRouter(testRoutes, { initialUrl: "/settings" });

    const rows = (await screen.findAllByRole("button")).map((b) => b.props.accessibilityLabel);
    expect(rows.indexOf("Notificaciones")).toBe(rows.indexOf("Editar perfil") + 1);
    await fireEvent.press(screen.getByRole("button", { name: "Notificaciones" }));

    await waitFor(() => expect(screen).toHavePathname("/notifications"));
    expect(await screen.findByRole("switch", { name: "Te suman a un rollo" })).toBeVisible();
  });

  it("shows the switches in four titled groups, from the server", async () => {
    permission(true, true, "granted");
    push.fetchNotificationSettings.mockResolvedValue({ ...ALL_ON, photoLiked: false });
    await renderRouter(testRoutes, { initialUrl: "/notifications" });

    for (const label of LABELS) expect(await screen.findByRole("switch", { name: label })).toBeVisible();
    expect(screen.getByRole("switch", { name: "Les gusta tu foto" }).props.value).toBe(false);
    expect(screen.getByRole("switch", { name: "Te suman a un rollo" }).props.value).toBe(true);
    for (const title of ["Rollos", "Amigos", "Tus fotos"]) expect(screen.getByText(title)).toBeVisible();
    expect(screen.getAllByText("Momento del día").length).toBeGreaterThan(1); // group title + switch label
    expect(screen.getByText("Se revela: cuando se pueden ver las fotos de un rollo tuyo.")).toBeVisible();
    expect(screen.getByText("Cuando alguien acepta tu link de amistad o te manda una solicitud.")).toBeVisible();
    expect(screen.getByText("Cuando alguien destaca, le da me gusta o comenta una foto tuya (o una que comentaste).")).toBeVisible();
    expect(screen.getByText("Un aviso al día, a una hora al azar, para sacar tu foto; y otro cuando alguien del rollo sube la suya.")).toBeVisible();
    // With permission there's no banner.
    expect(screen.queryByText("Las notificaciones están desactivadas")).toBeNull();
  });

  it("'Momentos del grupo' saves only momentPosted", async () => {
    permission(true, true, "granted");
    await renderRouter(testRoutes, { initialUrl: "/notifications" });

    const sw = await screen.findByRole("switch", { name: "Momentos del grupo" });
    expect(sw.props.value).toBe(true);
    await fireEvent(sw, "valueChange", false);

    expect(push.updateNotificationSettings).toHaveBeenCalledWith({ momentPosted: false });
    await waitFor(() => expect(screen.getByRole("switch", { name: "Momentos del grupo" }).props.value).toBe(false));
  });

  it("'Momento del día' off saves it, then leaves no moment.* scheduled", async () => {
    permission(true, true, "granted");
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue(
      [{ identifier: "moment.t1.2027-01-12" }, { identifier: "other" }] as never,
    );
    await renderRouter(testRoutes, { initialUrl: "/notifications" });

    await fireEvent(await screen.findByRole("switch", { name: "Momento del día" }), "valueChange", false);

    expect(push.updateNotificationSettings).toHaveBeenCalledWith({ dailyMoment: false });
    await waitFor(() => expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("moment.t1.2027-01-12"));
    expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith("other");
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  });

  it("'Momento del día' on saves it, then syncs the moments", async () => {
    permission(true, true, "granted");
    push.fetchNotificationSettings.mockResolvedValue({ ...ALL_ON, dailyMoment: false });
    jest.mocked(syncMoments).mockClear();
    await renderRouter(testRoutes, { initialUrl: "/notifications" });

    const sw = await screen.findByRole("switch", { name: "Momento del día" });
    expect(sw.props.value).toBe(false);
    await fireEvent(sw, "valueChange", true);

    expect(push.updateNotificationSettings).toHaveBeenCalledWith({ dailyMoment: true });
    await waitFor(() => expect(syncMoments).toHaveBeenCalledTimes(1));
  });

  it("a switch saves only its own key and moves at once", async () => {
    permission(true, true, "granted");
    let resolve!: (v: typeof ALL_ON) => void;
    push.updateNotificationSettings.mockReturnValue(new Promise((r) => (resolve = r)));
    await renderRouter(testRoutes, { initialUrl: "/notifications" });

    await fireEvent(await screen.findByRole("switch", { name: "Arranca un rollo" }), "valueChange", false);

    expect(push.updateNotificationSettings).toHaveBeenCalledWith({ tripStarted: false });
    expect(screen.getByRole("switch", { name: "Arranca un rollo" }).props.value).toBe(false);
    await act(async () => resolve({ ...ALL_ON, tripStarted: false }));
    expect(screen.getByRole("switch", { name: "Arranca un rollo" }).props.value).toBe(false);
  });

  it("if saving fails the switch goes back and the error shows inline", async () => {
    permission(true, true, "granted");
    push.updateNotificationSettings.mockRejectedValue(new Error("Sin conexión"));
    await renderRouter(testRoutes, { initialUrl: "/notifications" });

    await fireEvent(await screen.findByRole("switch", { name: "Destacan tu foto" }), "valueChange", false);

    expect(await screen.findByText("Sin conexión")).toBeVisible();
    expect(screen.getByRole("switch", { name: "Destacan tu foto" }).props.value).toBe(true);
  });

  it("if loading fails it offers to retry", async () => {
    permission(true, true, "granted");
    push.fetchNotificationSettings.mockRejectedValueOnce(new Error("Sin conexión"));
    await renderRouter(testRoutes, { initialUrl: "/notifications" });

    await fireEvent.press(await screen.findByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("switch", { name: "Nuevos amigos" })).toBeVisible();
  });

  it("never asked: the banner asks for the permission and registers the token", async () => {
    await renderRouter(testRoutes, { initialUrl: "/notifications" });

    expect(await screen.findByText("Las notificaciones están desactivadas")).toBeVisible();
    expect(screen.getByText("Vas a ver estos ajustes, pero los avisos no van a llegar hasta que las actives.")).toBeVisible();
    expect(await screen.findByRole("switch", { name: "Nuevos amigos" })).toBeVisible();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();

    permission(true, true, "granted");
    await fireEvent.press(screen.getByRole("button", { name: "Activar notificaciones" }));

    await waitFor(() => expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(push.registerPushToken).toHaveBeenCalledWith(TOKEN));
    await waitFor(() => expect(screen.queryByText("Las notificaciones están desactivadas")).toBeNull());
  });

  it("denied: the banner opens iOS Settings and asks nothing", async () => {
    permission(false, false, "denied");
    const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue();
    await renderRouter(testRoutes, { initialUrl: "/notifications" });

    expect(await screen.findByText("Las notificaciones están desactivadas")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Activar notificaciones" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Abrir Ajustes de iOS" }));

    expect(openSettings).toHaveBeenCalled();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
