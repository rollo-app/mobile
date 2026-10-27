import { Share } from "react-native";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import "@/test/reanimated";
import { ApiError } from "@/api/client";
import { queryClient } from "@/api/query-client";
import { createQueue, type Queue, type QueuedMedia } from "@/features/capture/queue";
import * as friendActions from "@/features/friends/actions";
import * as profileActions from "@/features/profile/actions";
import * as actions from "@/features/trips/actions";
import { formatDateTime } from "@/features/trips/phase";
import { getActiveTripId } from "@/storage/active-trip";
import { markPushPrimerSeen } from "@/storage/push-primer";
import { signInAs, tripSummary } from "@/test/account";
import { memoryDb } from "@/test/sqlite-memory";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/friends/actions");
const mocked = jest.mocked(actions);
const friends = jest.mocked(friendActions);
const { getQueue } = jest.requireMock("@/features/capture/store") as { getQueue: jest.Mock };

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";
const BARILOCHE = "33333333-3333-4333-8333-333333333333";

const trip = (overrides: Partial<actions.Trip> = {}): actions.Trip => ({
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
  ...overrides,
});

const detail = (overrides: Partial<actions.TripDetail> = {}): actions.TripDetail => ({
  trip: trip(),
  me: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin", blockedByMe: false },
  members: [
    { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin", blockedByMe: false },
    { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null, role: "member", blockedByMe: false },
  ],
  today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 12,
  ...overrides,
});

const saveTrip = (tripId: string, tripName: string) => signInAs({ trips: [tripSummary(tripId, tripName)] });

describe("Home", () => {
  it("with no trips it invites you to start a roll or join", async () => {
    await signInAs({ trips: [] });
    await renderRouter(routes, { initialUrl: "/" });

    expect(await screen.findByRole("button", { name: "Empezar un nuevo rollo" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sumarme con un código" })).toBeVisible();
  });

  it("the buttons lead to create and join", async () => {
    await signInAs({ trips: [] });
    await renderRouter(routes, { initialUrl: "/" });

    await fireEvent.press(await screen.findByRole("button", { name: "Sumarme con un código" }));
    expect(screen).toHavePathname("/join");
  });

  it("with saved trips it opens the roll of the last one you opened", async () => {
    await saveTrip(SUR, "Viaje al sur");
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/" });

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(await screen.findByText("7 de 10")).toBeVisible();
    expect(mocked.fetchTrip).toHaveBeenCalledWith(SUR);
  });
});

describe("Roll", () => {
  beforeEach(() => saveTrip(SUR, "Viaje al sur"));

  it("shows how much is in the roll, what you have left today and when it is revealed", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByLabelText("12 en el rollo")).toBeVisible();
    expect(screen.getByText("7 de 10")).toBeVisible();
    expect(screen.queryByText("Videos")).toBeNull();
    expect(screen.getByText("en 9 días")).toBeVisible();
  });

  it("with a total limit it shows what you have left in the whole rollo", async () => {
    mocked.fetchTrip.mockResolvedValue(
      detail({ trip: trip({ photoLimitMode: "total", totalPhotoLimit: 20 }), today: { date: "2027-01-05", photosLeft: 13, videosLeft: 0 } }),
    );
    await renderRouter(routes, { initialUrl: "/roll" });

    await screen.findByLabelText("12 en el rollo");
    expect(screen.getByText("Te quedan")).toBeVisible();
    expect(screen.getByText("13 de 20")).toBeVisible();
    expect(screen.queryByText("Hoy")).toBeNull();
  });

  const TZ = "America/Argentina/Buenos_Aires";
  const when = (ms: number) => formatDateTime(ms, Date.now(), TZ);

  it("while active it shows today's quota above the three dates, with when it ends and is revealed", async () => {
    const t = trip();
    mocked.fetchTrip.mockResolvedValue(detail({ trip: t }));
    await renderRouter(routes, { initialUrl: "/roll" });

    await screen.findByLabelText("12 en el rollo");
    expect(screen.getByText("Fechas")).toBeVisible();
    for (const label of ["Empieza", "Termina", "Se revela"]) expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByText(when(t.startsAt))).toBeVisible();
    expect(screen.getByText("Empezó")).toBeVisible();
    expect(screen.getAllByText(when(t.endsAt))).toHaveLength(2);
  });

  it("before it starts it hides today's quota and counts down to the start", async () => {
    const t = trip({ startsAt: Date.now() + 5 * DAY, endsAt: Date.now() + 9 * DAY, revealAt: Date.now() + 10 * DAY });
    mocked.fetchTrip.mockResolvedValue(detail({ trip: t }));
    await renderRouter(routes, { initialUrl: "/roll" });

    await screen.findByLabelText("12 en el rollo");
    for (const ms of [t.startsAt, t.endsAt, t.revealAt]) expect(screen.getByText(when(ms))).toBeVisible();
    expect(screen.getByText("en 5 días")).toBeVisible();
    expect(screen.queryByText("7 de 10")).toBeNull(); // the quota row (Perfil's "Fotos" segment is mounted too)
  });

  it("once it ended it keeps the three dates, marks it ended and counts down to the reveal", async () => {
    const t = trip({ startsAt: Date.now() - 9 * DAY, endsAt: Date.now() - DAY, revealAt: Date.now() + 3 * DAY });
    mocked.fetchTrip.mockResolvedValue(detail({ trip: t }));
    await renderRouter(routes, { initialUrl: "/roll" });

    await screen.findByLabelText("12 en el rollo");
    for (const ms of [t.startsAt, t.endsAt, t.revealAt]) expect(screen.getByText(when(ms))).toBeVisible();
    expect(screen.getByText("Terminó")).toBeVisible();
    expect(screen.getByText("en 3 días")).toBeVisible();
    expect(screen.queryByText("7 de 10")).toBeNull(); // the quota row (Perfil's "Fotos" segment is mounted too)
  });

  it("the contact sheet shows each photo's ThumbHash, newest to oldest", async () => {
    mocked.fetchTrip.mockResolvedValue(detail({ totalUploaded: 2 }));
    mocked.fetchFeed.mockResolvedValue({
      revealed: false,
      revealAt: Date.now() + 9 * DAY,
      items: [
        { id: "a", type: "photo", takenAt: 1, day: "2027-01-01", lat: null, lng: null, caption: null, thumbhash: "vieja", durationS: null, author: { id: "m", userId: "u-m", name: "Fede", username: null, avatarUrl: null } },
        { id: "b", type: "photo", takenAt: 2, day: "2027-01-01", lat: null, lng: null, caption: null, thumbhash: "nueva", durationS: null, author: { id: "m", userId: "u-m", name: "Fede", username: null, avatarUrl: null } },
      ],
    });
    await renderRouter(routes, { initialUrl: "/roll" });

    await screen.findByLabelText("2 en el rollo");
    const frames = await screen.findAllByTestId(/^thumbhash-/);
    const hashes = frames.map((n) => n.props.testID);
    expect(hashes).toEqual(["thumbhash-nueva", "thumbhash-vieja"]);
  });

  it("if loading fails it shows the error", async () => {
    mocked.fetchTrip.mockRejectedValue(new Error("Sin conexión. Probá de nuevo cuando tengas señal."));
    await renderRouter(routes, { initialUrl: "/roll" });

    expect((await screen.findAllByText("Sin conexión. Probá de nuevo cuando tengas señal."))[0]).toBeVisible();
  });
});

describe("Roll with unuploaded photos", () => {
  let queue: Queue;
  const queued = (): QueuedMedia => ({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    tripId: SUR,
    type: "photo",
    takenAt: Date.now(),
    day: "2027-01-05",
    lat: null,
    lng: null,
    accuracyM: null,
    caption: null,
    durationS: null,
    width: 4000,
    height: 3000,
    sizeBytes: 1000,
    originalUri: "file:///docs/pending/a/original.jpg",
    thumbUri: "file:///docs/pending/a/thumb.jpg",
    thumbhash: null,
  });

  beforeEach(async () => {
    await saveTrip(SUR, "Viaje al sur");
    queue = await createQueue(memoryDb());
    getQueue.mockImplementation(() => Promise.resolve(queue));
  });

  it("counts your photos in the queue besides the server's", async () => {
    mocked.fetchTrip.mockResolvedValue(detail({ totalUploaded: 1 }));
    await queue.enqueue(queued());
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByLabelText("2 en el rollo")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
  });

  it("once uploaded it stays at 2: the server adds it and the queue drops it, without double counting", async () => {
    mocked.fetchTrip.mockResolvedValue(detail({ totalUploaded: 1 }));
    await queue.enqueue(queued());
    await renderRouter(routes, { initialUrl: "/roll" });
    expect(await screen.findByLabelText("2 en el rollo")).toBeVisible();

    // Same as the uploader does: remove it from the queue, then notify.
    mocked.fetchTrip.mockResolvedValue(detail({ totalUploaded: 2 }));
    await queue.remove(queued().id);
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["trip", SUR] });
      await queryClient.invalidateQueries({ queryKey: ["pending", SUR] });
    });

    expect(await screen.findByLabelText("2 en el rollo")).toBeVisible();
    expect(screen.queryByLabelText("3 en el rollo")).toBeNull();
  });
});

describe("Roll board · people and settings", () => {
  beforeEach(() => saveTrip(SUR, "Viaje al sur"));

  it("shows the invite code and the members below the dates", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByText("Invitar")).toBeVisible();
    expect(screen.getByText("HUB5FT")).toBeVisible();
    expect(screen.getByText("En el rollo · 2")).toBeVisible();
    expect(screen.getAllByText("Fede")[0]).toBeVisible();
    expect(screen.getByText("Admin")).toBeVisible();
  });

  it("shares the invitation with the roll's name and code", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction", activityType: undefined });
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/roll" });

    await fireEvent.press(await screen.findByRole("button", { name: "Compartir invitación" }));

    expect(share).toHaveBeenCalledWith({ message: 'Sumate a "Viaje al sur" en Rollo con el código HUB5FT' });
    share.mockRestore();
  });

  it("tapping a member opens their profile; your own row isn't tappable", async () => {
    const fetchUser = jest.spyOn(profileActions, "fetchUser").mockResolvedValue({
      user: { id: "u-m2", name: "Fede", username: "fede", avatarUrl: null, bio: null, badge: null },
      isFriend: false,
      blockedByMe: false,
      reportedByMe: false,
      profileVisibility: "friends",
      canSee: false,
      friendCount: 0,
      mutualCount: 0,
      friendRequest: "none",
    });
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/roll" });

    await screen.findByText("En el rollo · 2");
    expect(screen.queryByRole("button", { name: /^Juani/ })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Fede" }));

    await waitFor(() => expect(screen).toHavePathname("/user/u-m2"));
    expect(await screen.findByText("Este perfil es privado")).toBeVisible();
    expect(fetchUser).toHaveBeenCalledWith("u-m2");
    fetchUser.mockRestore();
  });

  it("has no 'Tus rollos' row", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/roll" });

    await screen.findByRole("button", { name: "Compartir invitación" });
    expect(screen.queryByRole("button", { name: /^Tus rollos/ })).toBeNull();
  });
});

describe("Me", () => {
  beforeEach(() => saveTrip(SUR, "Viaje al sur"));

  it("Perfil shows who you are, with no email or rollo sections", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/me" });

    expect(await screen.findByText("@juani")).toBeVisible();
    expect(screen.queryByText("juani@rollo.test")).toBeNull();
    for (const title of ["Rollo activo", "Invitar"]) expect(screen.queryByText(title)).toBeNull();
    expect(screen.queryByText(/^En el rollo/)).toBeNull();
    expect(screen.queryByText("HUB5FT")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Tus rollos/ })).toBeNull();
  });

  it("Ajustes is the account and device: Editar perfil, offline map and sign out, with no rollo sections", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/settings" });

    expect(await screen.findByRole("button", { name: "Editar perfil" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Mapa sin señal/ })).toBeVisible();
    expect(screen.queryByText("juani@rollo.test")).toBeNull();
    expect(screen.queryByText("HUB5FT")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Tus rollos/ })).toBeNull();
  });

  it("in development, a row in Ajustes triggers the background upload for testing", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/settings" });

    await fireEvent.press(await screen.findByRole("button", { name: "Probar subida en segundo plano" }));

    expect(BackgroundTask.triggerTaskWorkerForTestingAsync).toHaveBeenCalled();
  });

  it("in development, 'Probar momento ahora' schedules a moment for the active roll in 10 seconds", async () => {
    await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
    mocked.fetchTrip.mockResolvedValue(detail());
    jest.mocked(Notifications.scheduleNotificationAsync).mockClear();
    await renderRouter(routes, { initialUrl: "/settings" });

    const before = Date.now();
    await fireEvent.press(await screen.findByRole("button", { name: "Probar momento ahora" }));

    await waitFor(() => expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1));
    const req = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls[0]![0] as any;
    const at = req.trigger.date as number;
    expect(at - before).toBeGreaterThanOrEqual(9_000);
    expect(at - before).toBeLessThanOrEqual(12_000);
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
    expect(req.identifier).toBe(`moment.${SUR}.${day}`);
    expect(req.content.data.url).toBe(`/moment?trip=${SUR}&day=${day}&at=${at}`);
    expect(req.content.title).toBe("Es tu momento");
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(jest.requireMock("burnt").toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Llega en 10 segundos" }));
  });

  it("in development, 'Probar momento ahora' says so and schedules nothing without notification permission", async () => {
    await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
    mocked.fetchTrip.mockResolvedValue(detail());
    jest.mocked(Notifications.scheduleNotificationAsync).mockClear();
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValueOnce({ granted: false, canAskAgain: false } as any);
    await renderRouter(routes, { initialUrl: "/settings" });

    await fireEvent.press(await screen.findByRole("button", { name: "Probar momento ahora" }));

    await waitFor(() =>
      expect(jest.requireMock("burnt").alert).toHaveBeenCalledWith(expect.objectContaining({ title: "Activá las notificaciones" })),
    );
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("in development, 'Ver revelado' in Ajustes opens the reveal screen", async () => {
    await signInAs({ trips: [tripSummary(SUR, "Viaje al sur", { revealed: true })] });
    mocked.fetchTrip.mockResolvedValue(detail());
    mocked.fetchFeed.mockReturnValue(new Promise(() => {})); // stays on the reveal while it loads
    await renderRouter(routes, { initialUrl: "/settings" });

    await fireEvent.press(await screen.findByRole("button", { name: "Ver revelado" }));

    await waitFor(() => expect(screen).toHavePathname("/reveal"));
  });
});

describe("Trip picker", () => {
  it("lists your trips and choosing one makes it the active one", async () => {
    mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
    await signInAs({ trips: [tripSummary(BARILOCHE, "Bariloche"), tripSummary(SUR, "Viaje al sur")], active: SUR });
    await renderRouter(routes, { initialUrl: "/trips" });

    await fireEvent.press(await screen.findByRole("button", { name: "Bariloche" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(await getActiveTripId()).toBe(BARILOCHE);
  });

  it("shows each roll's state: LIVE, Revelado, or when it starts", async () => {
    mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    await signInAs({
      trips: [
        tripSummary(SUR, "Sur (prueba)", { startsAt: now - day, endsAt: now + day, revealAt: now + day, coverThumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI" }),
        tripSummary(BARILOCHE, "Bariloche", { startsAt: now - 9 * day, endsAt: now - 2 * day, revealAt: now - day, revealed: true }),
        tripSummary("44444444-4444-4444-8444-444444444444", "Tandil", { startsAt: now + 10 * day, endsAt: now + 12 * day, revealAt: now + 12 * day }),
      ],
      active: SUR,
    });
    await renderRouter(routes, { initialUrl: "/trips" });

    expect(await screen.findByRole("button", { name: "Sur (prueba), en vivo" })).toBeVisible();
    expect(screen.getByText("LIVE")).toBeVisible();
    expect(screen.getByRole("button", { name: "Bariloche, revelado" })).toBeVisible();
    expect(screen.getByText("Revelado")).toBeVisible();
    expect(screen.getByRole("button", { name: "Tandil" })).toBeVisible();
    expect(screen.getByText(/^Empieza en \d+ días$/)).toBeVisible();
    expect(screen.getAllByText(/^(LIVE|Revelado)$/)).toHaveLength(2);
  });

  describe("grouping", () => {
    const OLD = "55555555-5555-4555-8555-555555555555";
    const revealedAgo = (id: string, name: string, days: number) => {
      const now = Date.now();
      return tripSummary(id, name, { startsAt: now - (days + 8) * DAY, endsAt: now - (days + 1) * DAY, revealAt: now - days * DAY, revealed: true });
    };

    it("shows recent revealed rolls under 'Revelados' and keeps the old ones collapsed", async () => {
      mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
      await signInAs({ trips: [revealedAgo(BARILOCHE, "Bariloche", 10), revealedAgo(OLD, "Mendoza", 200)], active: BARILOCHE });
      await renderRouter(routes, { initialUrl: "/trips" });

      expect(await screen.findByText("Revelados")).toBeVisible();
      expect(screen.getByRole("button", { name: "Bariloche, revelado" })).toBeVisible();
      expect(screen.getByText("Anteriores · 1")).toBeVisible();
      expect(screen.getByRole("button", { name: "Anteriores, 1" }).props.accessibilityState).toMatchObject({ expanded: false });
      expect(screen.queryByRole("button", { name: "Mendoza, revelado" })).toBeNull();
    });

    it("expands the old rolls inline when you tap 'Anteriores' and collapses them again", async () => {
      mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
      await signInAs({ trips: [revealedAgo(BARILOCHE, "Bariloche", 10), revealedAgo(OLD, "Mendoza", 200)], active: BARILOCHE });
      await renderRouter(routes, { initialUrl: "/trips" });

      await fireEvent.press(await screen.findByRole("button", { name: "Anteriores, 1" }));
      expect(screen.getByRole("button", { name: "Mendoza, revelado" })).toBeVisible();

      await fireEvent.press(screen.getByRole("button", { name: "Anteriores, 1" }));
      expect(screen.queryByRole("button", { name: "Mendoza, revelado" })).toBeNull();
    });

    it("starts expanded when the active roll is an old one", async () => {
      mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
      await signInAs({ trips: [revealedAgo(BARILOCHE, "Bariloche", 10), revealedAgo(OLD, "Mendoza", 200)], active: OLD });
      await renderRouter(routes, { initialUrl: "/trips" });

      expect(await screen.findByRole("button", { name: "Mendoza, revelado" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Mendoza, revelado" }).props.accessibilityState).toMatchObject({ selected: true });
    });

    it("has no 'Anteriores' row without old rolls", async () => {
      mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
      await signInAs({ trips: [revealedAgo(BARILOCHE, "Bariloche", 10)], active: BARILOCHE });
      await renderRouter(routes, { initialUrl: "/trips" });

      await screen.findByText("Revelados");
      expect(screen.queryByText(/^Anteriores/)).toBeNull();
    });

    it("choosing an old roll makes it the active one", async () => {
      mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
      await signInAs({ trips: [revealedAgo(BARILOCHE, "Bariloche", 10), revealedAgo(OLD, "Mendoza", 200)], active: BARILOCHE });
      await renderRouter(routes, { initialUrl: "/trips" });

      await fireEvent.press(await screen.findByRole("button", { name: "Anteriores, 1" }));
      await fireEvent.press(screen.getByRole("button", { name: "Mendoza, revelado" }));

      await waitFor(() => expect(screen).toHavePathname("/roll"));
      expect(await getActiveTripId()).toBe(OLD);
    });
  });

  it("has shortcuts to start a roll or join", async () => {
    await saveTrip(SUR, "Viaje al sur");
    await renderRouter(routes, { initialUrl: "/trips" });

    await fireEvent.press(await screen.findByRole("button", { name: "Empezar un nuevo rollo" }));
    expect(screen).toHavePathname("/create");
  });
});

describe("Join", () => {
  // The one-time notifications primer has its own tests (notifications.test.tsx).
  beforeEach(async () => {
    await signInAs({ trips: [] });
    await markPushPrimerSeen();
  });

  it("the button stays disabled until there is a 6-character code", async () => {
    await renderRouter(routes, { initialUrl: "/join" });
    const button = await screen.findByRole("button", { name: "Unirme" });

    expect(button).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText("Código del rollo"), "hub5f");
    expect(button).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText("Código del rollo"), "hub5ft");
    expect(button).toBeEnabled();
  });

  it("joining goes to the roll", async () => {
    mocked.joinTrip.mockImplementation(async () => {
      await saveTrip(SUR, "Viaje al sur");
      return trip();
    });
    mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
    await renderRouter(routes, { initialUrl: "/join" });

    await fireEvent.changeText(await screen.findByLabelText("Código del rollo"), "hub5ft");
    await fireEvent.press(screen.getByRole("button", { name: "Unirme" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(mocked.joinTrip).toHaveBeenCalledWith({ code: "hub5ft" });
  });

  it("shows the server error", async () => {
    mocked.joinTrip.mockRejectedValue(new Error("Código inválido"));
    await renderRouter(routes, { initialUrl: "/join" });

    await fireEvent.changeText(await screen.findByLabelText("Código del rollo"), "ZZZZZZ");
    await fireEvent.press(screen.getByRole("button", { name: "Unirme" }));

    expect(await screen.findByText("Código inválido")).toBeVisible();
    expect(screen).toHavePathname("/join");
  });
});

describe("Join roll header", () => {
  beforeEach(() => signInAs({ trips: [] }));

  it("cancels from the header and goes back", async () => {
    await renderRouter(routes, { initialUrl: "/" });
    await fireEvent.press(await screen.findByRole("button", { name: "Sumarme con un código" }));
    expect(screen).toHavePathname("/join");

    await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen).toHavePathname("/roll");
  });
});

describe("Create roll", () => {
  beforeEach(async () => {
    await signInAs({ trips: [] });
    await markPushPrimerSeen();
    friends.fetchFriends.mockResolvedValue([]);
  });

  const HOUR = 60 * 60 * 1000;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dateOf = (label: string) => Number(screen.getByLabelText(label).props.accessibilityValue.text);
  const changeDate = (label: string, ms: number) => fireEvent(screen.getByLabelText(label), "dateChange", new Date(ms));
  const fillNames = async () => {
    await fireEvent.changeText(await screen.findByPlaceholderText("Nombre del rollo"), "Sur 2027");
  };

  it("needs the roll name before it can be created", async () => {
    await renderRouter(routes, { initialUrl: "/create" });
    const button = await screen.findByRole("button", { name: "Crear" });
    expect(button).toBeDisabled();

    await fireEvent.changeText(screen.getByPlaceholderText("Nombre del rollo"), "Sur 2027");
    expect(button).toBeEnabled();
  });

  it("starts at the next full hour, lasts 3 days and allows 10 photos a day, with no videos", async () => {
    await renderRouter(routes, { initialUrl: "/create" });
    await screen.findByRole("button", { name: "Crear" });
    await fireEvent.press(screen.getByRole("button", { name: "Otra fecha" }));

    const start = dateOf("Empieza");
    expect(start % HOUR).toBe(0);
    expect(start).toBeGreaterThan(Date.now());
    expect(start - Date.now()).toBeLessThanOrEqual(HOUR);
    expect(dateOf("Termina")).toBe(start + 72 * HOUR);
    expect(screen.getByLabelText("10 fotos")).toBeVisible();
    expect(screen.getByRole("button", { name: "Por día" })).toBeSelected();
    expect(screen.queryByLabelText(/video/)).toBeNull();
    expect(screen.getByText("Hasta el revelado nadie ve las fotos, ni las propias.")).toBeVisible();
    expect(screen.getByText("Cada día se renueva a la medianoche.")).toBeVisible();
  });

  it("creates the roll with the chosen dates and limits, revealing at the end by default", async () => {
    mocked.createTrip.mockImplementation(async () => {
      await saveTrip(SUR, "Sur 2027");
      return trip();
    });
    mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
    await renderRouter(routes, { initialUrl: "/create" });
    await fillNames();
    await fireEvent.press(screen.getByRole("button", { name: "Otra fecha" }));
    const start = dateOf("Empieza");
    await changeDate("Termina", start + 5 * 24 * HOUR);
    await fireEvent(screen.getByLabelText("10 fotos"), "valueChange", 25);
    expect(screen.getByLabelText("25 fotos")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(mocked.createTrip).toHaveBeenCalledWith({
      name: "Sur 2027",
      startsAt: start,
      endsAt: start + 5 * 24 * HOUR,
      revealAt: start + 5 * 24 * HOUR,
      photoLimit: { mode: "daily", perDay: 25 },
      timezone: tz,
      momentMode: "photo_selfie",
      momentWindowStart: 540,
      momentWindowEnd: 1380,
    });
  });

  describe("Momento del día", () => {
    beforeEach(() => {
      mocked.createTrip.mockClear();
      mocked.createTrip.mockResolvedValue(trip());
      mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
    });

    it("defaults to two photos from 9:00 to 23:00", async () => {
      await renderRouter(routes, { initialUrl: "/create" });
      await fillNames();
      expect(screen.getByRole("button", { name: "Dos cámaras" })).toBeSelected();
      expect(new Date(dateOf("Desde")).getHours()).toBe(9);
      expect(new Date(dateOf("Hasta")).getHours()).toBe(23);
      await fireEvent.press(screen.getByRole("button", { name: "Crear" }));
      expect(mocked.createTrip).toHaveBeenCalledWith(
        expect.objectContaining({ momentMode: "photo_selfie", momentWindowStart: 540, momentWindowEnd: 1380 }),
      );
    });

    it("shows a footer for each mode", async () => {
      await renderRouter(routes, { initialUrl: "/create" });
      await fillNames();
      expect(screen.getByText("Un aviso por día a una hora al azar para cada uno. Tienen 15 minutos para sacar una foto con cada cámara; la primera es la grande.")).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: "Solo foto" }));
      expect(screen.getByText("Un aviso por día a una hora al azar para cada uno. Tienen 15 minutos para sacar una foto.")).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: "Apagado" }));
      expect(screen.getByText("Sin aviso diario.")).toBeTruthy();
    });

    it("hides the window when off and sends off", async () => {
      await renderRouter(routes, { initialUrl: "/create" });
      await fillNames();
      await fireEvent.press(screen.getByRole("button", { name: "Apagado" }));
      expect(screen.queryByLabelText("Desde")).toBeNull();
      expect(screen.queryByLabelText("Hasta")).toBeNull();
      await fireEvent.press(screen.getByRole("button", { name: "Crear" }));
      expect(mocked.createTrip).toHaveBeenCalledWith(expect.objectContaining({ momentMode: "off" }));
    });

    it("sends photo only", async () => {
      await renderRouter(routes, { initialUrl: "/create" });
      await fillNames();
      await fireEvent.press(screen.getByRole("button", { name: "Solo foto" }));
      await fireEvent.press(screen.getByRole("button", { name: "Crear" }));
      expect(mocked.createTrip).toHaveBeenCalledWith(expect.objectContaining({ momentMode: "photo" }));
    });

    it("sends the picked window and shows the server's reason inline", async () => {
      mocked.createTrip.mockRejectedValue(new Error("La franja del momento tiene que durar al menos 30 minutos"));
      await renderRouter(routes, { initialUrl: "/create" });
      await fillNames();
      await changeDate("Desde", new Date(2027, 0, 5, 22, 0).getTime());
      await changeDate("Hasta", new Date(2027, 0, 5, 22, 15).getTime());
      await fireEvent.press(screen.getByRole("button", { name: "Crear" }));
      expect(mocked.createTrip).toHaveBeenCalledWith(
        expect.objectContaining({ momentWindowStart: 1320, momentWindowEnd: 1335 }),
      );
      expect(await screen.findByText("La franja del momento tiene que durar al menos 30 minutos")).toBeVisible();
    });
  });

  it("lets the admin choose a total for the whole rollo instead of a daily limit", async () => {
    mocked.createTrip.mockResolvedValue(trip());
    mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
    await renderRouter(routes, { initialUrl: "/create" });
    await fillNames();

    await fireEvent.press(screen.getByRole("button", { name: "Todo el rollo" }));
    expect(screen.getByLabelText("20 fotos")).toBeVisible();
    expect(screen.getByText("Es el total de cada persona para todo el rollo.")).toBeVisible();
    await fireEvent(screen.getByLabelText("20 fotos"), "valueChange", 36);
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    expect(mocked.createTrip).toHaveBeenCalledWith(expect.objectContaining({ photoLimit: { mode: "total", total: 36 } }));
  });

  it("lets you pick another reveal moment, 12 hours after the end by default", async () => {
    mocked.createTrip.mockResolvedValue(trip());
    mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
    await renderRouter(routes, { initialUrl: "/create" });
    await fillNames();
    expect(screen.queryByLabelText("Se revela")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Otro momento" }));

    const end = dateOf("Termina");
    expect(dateOf("Se revela")).toBe(end + 12 * HOUR);
    await changeDate("Se revela", end + 48 * HOUR);
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    expect(mocked.createTrip).toHaveBeenCalledWith(expect.objectContaining({ endsAt: end, revealAt: end + 48 * HOUR }));
  });

  it("sends whatever dates were picked and shows the server's reason inline, keeping the form", async () => {
    mocked.createTrip.mockClear();
    mocked.createTrip.mockRejectedValue(new Error("El revelado no puede ser antes del fin"));
    await renderRouter(routes, { initialUrl: "/create" });
    await fillNames();
    await fireEvent.press(screen.getByRole("button", { name: "Otra fecha" }));
    await fireEvent.press(screen.getByRole("button", { name: "Otro momento" }));
    const end = dateOf("Termina");
    await changeDate("Se revela", end - HOUR);
    await changeDate("Empieza", end + 5 * HOUR);

    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    expect(mocked.createTrip).toHaveBeenCalledWith(
      expect.objectContaining({ startsAt: end + 5 * HOUR, endsAt: end, revealAt: end - HOUR }),
    );
    expect(await screen.findByText("El revelado no puede ser antes del fin")).toBeVisible();
    expect(dateOf("Empieza")).toBe(end + 5 * HOUR);
    expect(dateOf("Se revela")).toBe(end - HOUR);
    expect(screen.getByRole("button", { name: "Crear" })).toBeEnabled();
  });

  describe("starting now", () => {
    const NOW = Date.UTC(2027, 0, 5, 12, 20);
    // renderRouter installs fake timers, so the clock is moved with setSystemTime after rendering.

    it("starts now by default, without a start date picker, and sends the moment of submit", async () => {
      mocked.createTrip.mockResolvedValue(trip());
      mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
      await renderRouter(routes, { initialUrl: "/create" });
      jest.setSystemTime(NOW);
      await fillNames();
      expect(screen.getByRole("button", { name: "Ahora" })).toBeSelected();
      expect(screen.queryByLabelText("Empieza")).toBeNull();

      jest.setSystemTime(NOW + 3 * 60 * 1000);
      await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

      expect(mocked.createTrip).toHaveBeenCalledWith(expect.objectContaining({ startsAt: NOW + 3 * 60 * 1000 }));
    });

    it("with another date it shows the picker and sends the chosen date", async () => {
      mocked.createTrip.mockResolvedValue(trip());
      mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
      await renderRouter(routes, { initialUrl: "/create" });
      jest.setSystemTime(NOW);
      await fillNames();

      await fireEvent.press(screen.getByRole("button", { name: "Otra fecha" }));
      expect(dateOf("Empieza") % HOUR).toBe(0);
      await changeDate("Empieza", Date.UTC(2027, 0, 8, 9, 0));
      await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

      expect(mocked.createTrip).toHaveBeenCalledWith(expect.objectContaining({ startsAt: Date.UTC(2027, 0, 8, 9, 0) }));
    });

    it("moves the end after the chosen start when switching modes", async () => {
      await renderRouter(routes, { initialUrl: "/create" });
      jest.setSystemTime(NOW);
      await fillNames();
      await fireEvent.press(screen.getByRole("button", { name: "Otra fecha" }));
      await changeDate("Empieza", Date.UTC(2027, 0, 20, 9, 0));
      await changeDate("Termina", Date.UTC(2027, 0, 6, 9, 0));
      await fireEvent.press(screen.getByRole("button", { name: "Ahora" }));
      await fireEvent.press(screen.getByRole("button", { name: "Otra fecha" }));

      expect(dateOf("Termina")).toBe(Date.UTC(2027, 0, 20, 9, 0) + 72 * HOUR);
    });
  });

  it("cancels from the header and goes back", async () => {
    await renderRouter(routes, { initialUrl: "/" });
    await fireEvent.press(await screen.findByRole("button", { name: "Empezar un nuevo rollo" }));
    expect(screen).toHavePathname("/create");

    await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen).toHavePathname("/roll");
  });

  it("shows the server error without losing what was typed", async () => {
    mocked.createTrip.mockRejectedValue(new Error("Nombre demasiado largo"));
    await renderRouter(routes, { initialUrl: "/create" });
    await fillNames();
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    expect(await screen.findByText("Nombre demasiado largo")).toBeVisible();
    expect(screen.getByRole("button", { name: "Crear" })).toBeEnabled();
  });

  it("shows the server's limit message (409) inline under the button and keeps the typed values", async () => {
    const message = "Ya tenés 2 rollos sin revelar. Esperá a que se revele uno para crear otro.";
    mocked.createTrip.mockRejectedValue(new ApiError(409, message));
    await renderRouter(routes, { initialUrl: "/create" });
    await fillNames();
    await fireEvent(screen.getByLabelText("10 fotos"), "valueChange", 25);
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    expect(await screen.findByText(message)).toBeVisible();
    expect(screen).toHavePathname("/create");
    // "Crear" is only enabled with a name, so the name is still there.
    expect(screen.getByRole("button", { name: "Crear" })).toBeEnabled();
    expect(screen.getByLabelText("25 fotos")).toBeVisible();
  });

  describe("offering to add friends", () => {
    const cami: friendActions.Friend = { id: "u2", name: "Cami", username: "cami", avatarUrl: null, bio: null };

    const create = async () => {
      mocked.createTrip.mockImplementation(async () => {
        await saveTrip(SUR, "Sur 2027");
        return trip();
      });
      mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
      await renderRouter(routes, { initialUrl: "/create" });
      await fillNames();
      await fireEvent.press(screen.getByRole("button", { name: "Crear" }));
    };

    it("with friends, opens Sumar amigos on top of the new roll", async () => {
      friends.fetchFriends.mockResolvedValue([cami]);
      await create();

      await waitFor(() => expect(screen).toHavePathname("/add-friends"));
      expect(await screen.findByText("Cami")).toBeVisible();
      await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }));
      expect(screen).toHavePathname("/roll");
    });

    it("with no friends, just lands on the roll", async () => {
      await create();

      await waitFor(() => expect(screen).toHavePathname("/roll"));
      await act(async () => {});
      expect(screen).toHavePathname("/roll");
    });

    it("if the friends can't be loaded, lands on the roll without an error", async () => {
      friends.fetchFriends.mockRejectedValue(new Error("Sin señal"));
      await create();

      await waitFor(() => expect(friends.fetchFriends).toHaveBeenCalled());
      await act(async () => {});
      expect(screen).toHavePathname("/roll");
      expect(screen.queryByText("Sin señal")).toBeNull();
    });
  });
});
