import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { ActionSheetIOS, Alert, Linking } from "react-native";
import { createQueue } from "@/features/capture/queue";
import * as moderationActions from "@/features/moderation/actions";
import * as authActions from "@/features/auth/actions";
import * as friendActions from "@/features/friends/actions";
import * as profileActions from "@/features/profile/actions";
import * as actions from "@/features/trips/actions";
import { getSessionToken } from "@/storage/session";
import { signInAs, tripSummary, USER } from "@/test/account";
import { memoryDb } from "@/test/sqlite-memory";
import "@/test/reanimated";
import { routes } from "@/test/routes";
import * as featuredActions from "@/features/featured/actions";

jest.mock("@/features/trips/actions");
// Perfil is mounted too: nobody has featured photos, so its own "Reintentar" stays out of the way.
jest.mock("@/features/featured/actions");
beforeEach(() => {
  jest.mocked(featuredActions).fetchFeatured.mockResolvedValue([]);
});
jest.mock("@/features/friends/actions");
// Ajustes asks who you blocked: keep it out of the recorded fetch calls.
jest.mock("@/features/moderation/actions");
// The tabs sync the daily moments on mount: also out of the recorded fetch calls.
jest.mock("@/features/moments/actions", () => ({ fetchAllMyMoments: jest.fn(async () => []) }));
jest.mock("expo-image-picker");
jest.mock("expo-image-manipulator", () => {
  const saved = { uri: "file:///cache/cropped.jpg", width: 512, height: 512 };
  const ctx: Record<string, jest.Mock> = {};
  ctx.crop = jest.fn(() => ctx);
  ctx.resize = jest.fn(() => ctx);
  ctx.renderAsync = jest.fn(async () => ({ saveAsync: jest.fn(async () => saved) }));
  return { ImageManipulator: { manipulate: jest.fn(() => ctx), __ctx: ctx }, SaveFormat: { JPEG: "jpeg" } };
});
const manipulator = jest.requireMock("expo-image-manipulator") as {
  ImageManipulator: { manipulate: jest.Mock; __ctx: { crop: jest.Mock; resize: jest.Mock } };
};
const mocked = jest.mocked(actions);
const picker = jest.mocked(ImagePicker);
const { getQueue } = jest.requireMock("@/features/capture/store") as { getQueue: jest.Mock };

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";

const tripDetail = (): actions.TripDetail => ({
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
    createdBy: null,
  },
  me: { id: "m1", userId: "u1", name: "Juani", username: null, avatarUrl: null, role: "admin", isCreator: false, blockedByMe: false },
  members: [
    { id: "m1", userId: "u1", name: "Juani", username: "juani", avatarUrl: null, role: "admin", isCreator: false, blockedByMe: false },
    { id: "m2", userId: "u2", name: "Fede", username: "fede.s", avatarUrl: null, role: "member", isCreator: false, blockedByMe: false },
  ],
  today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 3,
});

type Handler = Response | ((req: Request) => Response | Promise<Response>);
const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Routes `fetch` by "METHOD /path"; anything else is a 404. Returns the calls made. */
function mockApi(routesByKey: Record<string, Handler>) {
  const calls: string[] = [];
  globalThis.fetch = jest.fn(async (req: Request) => {
    const key = `${req.method} ${new URL(req.url).pathname}`;
    calls.push(key);
    const handler = routesByKey[key];
    if (!handler) return json(404, { error: `sin ruta ${key}` });
    return typeof handler === "function" ? handler(req) : handler.clone();
  }) as unknown as typeof fetch;
  return calls;
}

let alert: jest.SpyInstance;
const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions");

beforeEach(() => {
  jest.mocked(friendActions).fetchFriends.mockResolvedValue([]);
  jest.mocked(moderationActions).fetchBlocked.mockResolvedValue([]);
  mocked.fetchTrip.mockResolvedValue(tripDetail());
  mocked.fetchFeed.mockResolvedValue({ revealed: false, revealAt: Date.now() + DAY, items: [] });
  mocked.fetchMyTrips.mockResolvedValue({ trips: [tripSummary(SUR, "Viaje al sur")] });
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  sheet.mockReset();
});

afterEach(() => alert.mockRestore());

describe("Login", () => {
  it("without a session the app shows the email step and nothing else", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByLabelText("Tu email")).toBeVisible();
    expect(screen.queryByText("Fechas")).toBeNull();
  });

  it("the email screen links to the terms and the privacy policy", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await renderRouter(routes, { initialUrl: "/email" });

    await fireEvent.press(await screen.findByText("Términos"));
    expect(open).toHaveBeenLastCalledWith("https://rollo.juanifraga.com/terminos");
    await fireEvent.press(screen.getByText("Política de privacidad"));
    expect(open).toHaveBeenLastCalledWith("https://rollo.juanifraga.com/privacidad");
    open.mockRestore();
  });

  it("email → code → complete profile → the app", async () => {
    const calls = mockApi({
      "POST /auth/email/start": json(204),
      "POST /auth/email/verify": json(200, { token: "tok", user: { ...USER, name: null, username: null }, isNew: true }),
      "GET /usernames/juani": json(200, { available: true, username: "juani" }),
      "PATCH /me": json(200, USER),
    });
    await renderRouter(routes, { initialUrl: "/" });

    const email = await screen.findByLabelText("Tu email");
    expect(email.props.textContentType).toBe("emailAddress");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    await fireEvent.changeText(email, "Juani@Rollo.test");
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));

    const code = await screen.findByLabelText("Código");
    expect(code.props.textContentType).toBe("oneTimeCode");
    expect(code.props.keyboardType).toBe("default");
    expect(code.props.autoCapitalize).toBe("characters");
    expect(screen.getByText("Te mandamos un código de 6 caracteres a juani@rollo.test. Vale 5 minutos.")).toBeVisible();
    expect(screen.getByRole("button", { name: /^Reenviar código/ })).toBeDisabled();
    await fireEvent.changeText(code, "K7M4QX");

    expect(await screen.findByText("Completá tu perfil")).toBeVisible();
    expect(await getSessionToken()).toBe("tok");
    expect(screen.getByRole("button", { name: "Listo" })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText("Tu nombre"), "Juani");
    expect(screen.getByLabelText("Nombre de usuario").props.value).toBe("juani");
    expect(await screen.findByText("Disponible")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }));

    // A new account sees the app's intro once before landing in the app.
    expect(await screen.findByText("Sacá la foto.")).toBeVisible();
    expect(screen).toHavePathname("/intro");
    await fireEvent.press(await screen.findByRole("button", { name: "Empezar" }, { timeout: 4000 }));
    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(calls).toEqual(["POST /auth/email/start", "POST /auth/email/verify", "GET /usernames/juani", "PATCH /me"]);
  });

  it("a returning user with a name goes straight into the app", async () => {
    mockApi({
      "POST /auth/email/start": json(204),
      "POST /auth/email/verify": json(200, { token: "tok", user: USER, isNew: false }),
    });
    await renderRouter(routes, { initialUrl: "/" });

    await fireEvent.changeText(await screen.findByLabelText("Tu email"), "juani@rollo.test");
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));
    await fireEvent.changeText(await screen.findByLabelText("Código"), "K7M4QX");

    await waitFor(() => expect(screen).toHavePathname("/roll"));
  });

  it("a user with a name but no username still has to pick one", async () => {
    mockApi({
      "POST /auth/email/start": json(204),
      "POST /auth/email/verify": json(200, { token: "tok", user: { ...USER, username: null }, isNew: true }),
    });
    await renderRouter(routes, { initialUrl: "/" });

    await fireEvent.changeText(await screen.findByLabelText("Tu email"), "juani@rollo.test");
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));
    await fireEvent.changeText(await screen.findByLabelText("Código"), "K7M4QX");

    expect(await screen.findByText("Completá tu perfil")).toBeVisible();
    expect(screen.getByLabelText("Tu nombre").props.value).toBe("Juani");
  });

  it("shows the server's error inline on the email step and keeps what was typed", async () => {
    mockApi({ "POST /auth/email/start": json(429, { error: "Pediste demasiados códigos, esperá un rato" }) });
    await renderRouter(routes, { initialUrl: "/" });

    await fireEvent.changeText(await screen.findByLabelText("Tu email"), "juani@rollo.test");
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Pediste demasiados códigos, esperá un rato")).toBeVisible();
    expect(screen.getByLabelText("Tu email").props.value).toBe("juani@rollo.test");
  });

  it("shows a wrong code inline and stays on the code step", async () => {
    mockApi({
      "POST /auth/email/start": json(204),
      "POST /auth/email/verify": json(400, { error: "Código incorrecto o vencido" }),
    });
    await renderRouter(routes, { initialUrl: "/" });
    await fireEvent.changeText(await screen.findByLabelText("Tu email"), "juani@rollo.test");
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));

    await fireEvent.changeText(await screen.findByLabelText("Código"), "AAAAAA");

    expect(await screen.findByText("Código incorrecto o vencido")).toBeVisible();
    expect(await getSessionToken()).toBeNull();
  });

  it("types the code in uppercase and ignores characters it can't have", async () => {
    mockApi({ "POST /auth/email/start": json(204) });
    await renderRouter(routes, { initialUrl: "/" });
    await fireEvent.changeText(await screen.findByLabelText("Tu email"), "juani@rollo.test");
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));

    await fireEvent.changeText(await screen.findByLabelText("Código"), "k7-m0");

    expect(screen.getByLabelText("Código").props.value).toBe("K7M");
  });

  it("the code field has no native length limit, so iOS AutoFill can insert it", async () => {
    mockApi({ "POST /auth/email/start": json(204) });
    await renderRouter(routes, { initialUrl: "/" });
    await fireEvent.changeText(await screen.findByLabelText("Tu email"), "juani@rollo.test");
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));

    const code = await screen.findByLabelText("Código");
    expect(code.props.maxLength).toBeUndefined();
    expect(code.props.textContentType).toBe("oneTimeCode");
    expect(code.props.autoComplete).toBe("one-time-code");
  });

  it("an autofilled code with extra text is submitted, and stays in the field if it fails", async () => {
    let body: unknown;
    mockApi({
      "POST /auth/email/start": json(204),
      "POST /auth/email/verify": async (req) => {
        body = await req.json();
        return json(400, { error: "Código incorrecto o vencido" });
      },
    });
    await renderRouter(routes, { initialUrl: "/" });
    await fireEvent.changeText(await screen.findByLabelText("Tu email"), "juani@rollo.test");
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));

    await fireEvent.changeText(await screen.findByLabelText("Código"), " k7m-4qx ");

    expect(await screen.findByText("Código incorrecto o vencido")).toBeVisible();
    expect(body).toEqual(expect.objectContaining({ code: "K7M4QX" }));
    expect(screen.getByLabelText("Código").props.value).toBe("K7M4QX");
    expect(screen.getByText("Si el mail se borró, pedí otro código.")).toBeVisible();
    expect(screen.getByRole("button", { name: /^Reenviar código/ })).toBeVisible();
  });

  it("after a failed code, an autofilled new one is submitted instead of the old one", async () => {
    const codes: string[] = [];
    mockApi({
      "POST /auth/email/start": json(204),
      "POST /auth/email/verify": async (req) => {
        codes.push(((await req.json()) as { code: string }).code);
        return json(400, { error: "Código incorrecto o vencido" });
      },
    });
    await renderRouter(routes, { initialUrl: "/" });
    await fireEvent.changeText(await screen.findByLabelText("Tu email"), "juani@rollo.test");
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));
    await fireEvent.changeText(await screen.findByLabelText("Código"), "K7M4QX");
    expect(await screen.findByText("Código incorrecto o vencido")).toBeVisible();

    // AutoFill inserts at the cursor, after the old code.
    await fireEvent.changeText(screen.getByLabelText("Código"), "K7M4QXA2B3C4");

    await waitFor(() => expect(codes).toEqual(["K7M4QX", "A2B3C4"]));
    expect(screen.getByLabelText("Código").props.value).toBe("A2B3C4");
  });

  it("a resent code clears the old one from the field", async () => {
    mockApi({
      "POST /auth/email/start": json(204),
      "POST /auth/email/verify": json(400, { error: "Código incorrecto o vencido" }),
    });
    await renderRouter(routes, { initialUrl: "/" });
    await fireEvent.changeText(await screen.findByLabelText("Tu email"), "juani@rollo.test");
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));
    await fireEvent.changeText(await screen.findByLabelText("Código"), "K7M4QX");
    expect(await screen.findByText("Código incorrecto o vencido")).toBeVisible();

    const realNow = Date.now();
    const clock = jest.spyOn(Date, "now").mockImplementation(() => realNow + 61_000);
    try {
      await waitFor(() => expect(screen.getByRole("button", { name: "Reenviar código" })).toBeEnabled(), { timeout: 3000 });
      await fireEvent.press(screen.getByRole("button", { name: "Reenviar código" }));
      await waitFor(() => expect(screen.getByLabelText("Código").props.value).toBe(""));
      expect(screen.queryByText("Si el mail se borró, pedí otro código.")).toBeNull();
    } finally {
      clock.mockRestore();
    }
  });

  it("a failed resend doesn't suggest asking for another code", async () => {
    mockApi({
      "POST /auth/email/start": (() => {
        let n = 0;
        return () => (++n === 1 ? json(204) : json(429, { error: "Pediste demasiados códigos, esperá un rato" }));
      })(),
    });
    await renderRouter(routes, { initialUrl: "/" });
    await fireEvent.changeText(await screen.findByLabelText("Tu email"), "juani@rollo.test");
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByLabelText("Código");

    const realNow = Date.now();
    const clock = jest.spyOn(Date, "now").mockImplementation(() => realNow + 61_000);
    try {
      await waitFor(() => expect(screen.getByRole("button", { name: "Reenviar código" })).toBeEnabled(), { timeout: 3000 });
      await fireEvent.press(screen.getByRole("button", { name: "Reenviar código" }));
      expect(await screen.findByText("Pediste demasiados códigos, esperá un rato")).toBeVisible();
      expect(screen.queryByText("Si el mail se borró, pedí otro código.")).toBeNull();
    } finally {
      clock.mockRestore();
    }
  });

  it("doesn't suggest asking for another code before anything failed", async () => {
    mockApi({ "POST /auth/email/start": json(204) });
    await renderRouter(routes, { initialUrl: "/" });
    await fireEvent.changeText(await screen.findByLabelText("Tu email"), "juani@rollo.test");
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByLabelText("Código")).toBeVisible();
    expect(screen.queryByText("Si el mail se borró, pedí otro código.")).toBeNull();
    expect(screen.getByRole("button", { name: /^Reenviar código/ })).toBeVisible();
  });

  it("an expired code shows the server's message and resend still works once the wait is over", async () => {
    const calls = mockApi({
      "POST /auth/email/start": json(204),
      "POST /auth/email/verify": json(400, { error: "El código venció, pedí uno nuevo" }),
    });
    await renderRouter(routes, { initialUrl: "/" });
    await fireEvent.changeText(await screen.findByLabelText("Tu email"), "juani@rollo.test");
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));
    await fireEvent.changeText(await screen.findByLabelText("Código"), "K7M4QX");
    expect(await screen.findByText("El código venció, pedí uno nuevo")).toBeVisible();

    // The countdown ticks every second; move the clock past the 60 s wait.
    const realNow = Date.now();
    const clock = jest.spyOn(Date, "now").mockImplementation(() => realNow + 61_000);
    try {
      await waitFor(() => expect(screen.getByRole("button", { name: "Reenviar código" })).toBeEnabled(), { timeout: 3000 });
      await fireEvent.press(screen.getByRole("button", { name: "Reenviar código" }));
      await waitFor(() => expect(calls.filter((c) => c === "POST /auth/email/start")).toHaveLength(2));
      expect(screen.queryByText("El código venció, pedí uno nuevo")).toBeNull();
    } finally {
      clock.mockRestore();
    }
  });

  it("a 401 anywhere closes the session and goes back to the login", async () => {
    await signInAs({ trips: [] });
    mockApi({ "GET /me/trips": json(401, { error: "Sesión inválida, volvé a entrar" }) });
    mocked.fetchMyTrips.mockImplementation(jest.requireActual("@/features/trips/actions").fetchMyTrips);
    await renderRouter(routes, { initialUrl: "/trips" });
    await act(async () => {
      await jest.requireActual("@/api/query-client").queryClient.invalidateQueries({ queryKey: ["myTrips"] });
    });

    expect(await screen.findByLabelText("Tu email")).toBeVisible();
    expect(await getSessionToken()).toBeNull();
  });
});

describe("Profile and settings", () => {
  beforeEach(() => signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] }));

  it("shows your name and handle, not your email nor the active roll", async () => {
    await renderRouter(routes, { initialUrl: "/me" });

    expect(await screen.findByText("@juani")).toBeVisible();
    expect(screen.getAllByText("Juani").length).toBeGreaterThan(0);
    expect(screen.queryByText("juani@rollo.test")).toBeNull();
    expect(screen.queryByRole("button", { name: "Viaje al sur, Admin" })).toBeNull();
  });

  it("log out tells the server, lands on the login and keeps the pending photos", async () => {
    const queue = await createQueue(memoryDb());
    getQueue.mockImplementation(() => Promise.resolve(queue));
    await queue.enqueue({
      id: "q1", ownerUserId: "u1", tripId: SUR, type: "photo", takenAt: 1, day: "2027-01-12", lat: null, lng: null, accuracyM: null,
      caption: null, durationS: null, width: 1, height: 1, sizeBytes: 1,
      originalUri: "file:///docs/pending/q1/original.jpg", thumbUri: "file:///docs/pending/q1/thumb.jpg", thumbhash: null,
    });
    const calls = mockApi({ "POST /auth/logout": json(204) });
    await renderRouter(routes, { initialUrl: "/settings" });

    await fireEvent.press(await screen.findByRole("button", { name: "Cerrar sesión" }));

    expect(await screen.findByLabelText("Tu email")).toBeVisible();
    expect(calls).toContain("POST /auth/logout");
    expect(await getSessionToken()).toBeNull();
    expect(await queue.pending("u1")).toHaveLength(1);
  });

  it("dev settings can replay the app intro without a new account", async () => {
    mockApi({});
    await renderRouter(routes, { initialUrl: "/settings" });

    await fireEvent.press(await screen.findByRole("button", { name: "Ver intro" }));

    await waitFor(() => expect(screen).toHavePathname("/intro"));
  });

  it("log out shows the row as busy and ignores taps until it finishes", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const calls = mockApi({ "POST /auth/logout": async () => (await gate, json(204)) });
    await renderRouter(routes, { initialUrl: "/settings" });

    await fireEvent.press(await screen.findByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull());
    expect(calls.filter((c) => c === "POST /auth/logout")).toHaveLength(1);
    await act(async () => release());
    expect(await screen.findByLabelText("Tu email")).toBeVisible();
    expect(calls.filter((c) => c === "POST /auth/logout")).toHaveLength(1);
  });

  it("if log out rejects it shows the error inline and the row is tappable again", async () => {
    jest.spyOn(authActions, "logout").mockRejectedValueOnce(new Error("boom"));
    await renderRouter(routes, { initialUrl: "/settings" });

    await fireEvent.press(await screen.findByRole("button", { name: "Cerrar sesión" }));

    expect(await screen.findByText("boom")).toBeVisible();
    expect(await screen.findByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    expect(await getSessionToken()).toBe("session-token");
  });

  it("log out leaves no scheduled moment notifications, and only those", async () => {
    jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue(
      [{ identifier: "moment.t1.2027-01-12" }, { identifier: "other" }] as never,
    );
    mockApi({ "POST /auth/logout": json(204) });
    await renderRouter(routes, { initialUrl: "/settings" });

    await fireEvent.press(await screen.findByRole("button", { name: "Cerrar sesión" }));
    await screen.findByLabelText("Tu email");

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("moment.t1.2027-01-12");
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith("other");
    jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([]);
  });

  it("delete account asks for a native confirmation with the destructive warning", async () => {
    const calls = mockApi({ "DELETE /me": json(204) });
    await renderRouter(routes, { initialUrl: "/settings" });

    await fireEvent.press(await screen.findByRole("button", { name: "Borrar cuenta" }));

    expect(alert).toHaveBeenCalledWith(
      "¿Borrar tu cuenta?",
      "Se borran tu cuenta y todas tus fotos en todos los rollos, también en los ya revelados. No se puede deshacer.",
      expect.arrayContaining([expect.objectContaining({ text: "Borrar cuenta", style: "destructive" })]),
    );
    expect(calls).toEqual([]);
  });

  it("confirming deletes the account and goes back to the login", async () => {
    const calls = mockApi({ "DELETE /me": json(204) });
    await renderRouter(routes, { initialUrl: "/settings" });
    await fireEvent.press(await screen.findByRole("button", { name: "Borrar cuenta" }));

    const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === "Borrar cuenta")!.onPress!());

    expect(await screen.findByLabelText("Tu email")).toBeVisible();
    expect(calls).toEqual(["DELETE /me"]);
    expect(await getSessionToken()).toBeNull();
  });

  it("if deleting fails it shows the error inline and keeps the session", async () => {
    mockApi({ "DELETE /me": json(500, { error: "No se pudo borrar la cuenta" }) });
    await renderRouter(routes, { initialUrl: "/settings" });
    await fireEvent.press(await screen.findByRole("button", { name: "Borrar cuenta" }));

    const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === "Borrar cuenta")!.onPress!());

    expect(await screen.findByText("No se pudo borrar la cuenta")).toBeVisible();
    expect(await getSessionToken()).toBe("session-token");
  });
});

describe("Edit profile", () => {
  beforeEach(() => signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] }));

  it("opens from Perfil's Ajustes with your name, and saving closes the sheet and updates the profile", async () => {
    const calls = mockApi({ "PATCH /me": json(200, { ...USER, name: "Juan" }) });
    await renderRouter(routes, { initialUrl: "/me" });

    await fireEvent.press(await screen.findByRole("button", { name: "Ajustes" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Editar perfil" }));
    const input = await screen.findByLabelText("Tu nombre");
    expect(input.props.value).toBe("Juani");
    await fireEvent.changeText(input, "Juan");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen).toHavePathname("/settings"));
    expect(calls).toEqual(["PATCH /me"]);
    await act(async () => router.back());
    expect(await screen.findAllByText("Juan")).not.toHaveLength(0);
  });

  it("shows the email as a read-only row at the top of the form", async () => {
    await renderRouter(routes, { initialUrl: "/settings" });

    await fireEvent.press(await screen.findByRole("button", { name: "Editar perfil" }));

    expect(await screen.findByText("Email")).toBeVisible();
    expect(screen.getByText("juani@rollo.test")).toBeVisible();
    expect(screen.getByText("Es lo que hace única tu cuenta.")).toBeVisible();
  });

  describe("username", () => {
    const type = async (value: string) => fireEvent.changeText(await screen.findByLabelText("Nombre de usuario"), value);

    it("is prefilled with the current one, with the @ outside the field, and needs no check", async () => {
      const calls = mockApi({});
      await renderRouter(routes, { initialUrl: "/edit-profile" });

      const input = await screen.findByLabelText("Nombre de usuario");
      expect(input.props.value).toBe("juani");
      expect(input.props.autoCapitalize).toBe("none");
      expect(input.props.autoCorrect).toBe(false);
      expect(screen.getByText("@")).toBeVisible();
      expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
      expect(calls).toEqual([]);
    });

    it("checks availability after a pause, shows it, and saves name and username", async () => {
      const calls = mockApi({
        "GET /usernames/juani.f": json(200, { available: true, username: "juani.f" }),
        "PATCH /me": json(200, { ...USER, username: "juani.f" }),
      });
      await renderRouter(routes, { initialUrl: "/me" });
      await fireEvent.press(await screen.findByRole("button", { name: "Ajustes" }));
      await fireEvent.press(await screen.findByRole("button", { name: "Editar perfil" }));

      await type("@Juani.F");
      expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
      expect(await screen.findByText("Disponible")).toBeVisible();
      expect(calls).toEqual(["GET /usernames/juani.f"]);
      await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));

      await waitFor(() => expect(screen).toHavePathname("/settings"));
      expect(calls).toEqual(["GET /usernames/juani.f", "PATCH /me"]);
      await act(async () => router.back());
      expect(await screen.findByText("@juani.f")).toBeVisible();
    });

    it("says it is taken and blocks saving", async () => {
      mockApi({ "GET /usernames/cami": json(200, { available: false, username: "cami" }) });
      await renderRouter(routes, { initialUrl: "/edit-profile" });

      await type("cami");

      expect(await screen.findByText("Ese nombre de usuario ya está en uso.")).toBeVisible();
      expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    });

    it("shows the invalid message right away, without asking the server", async () => {
      const calls = mockApi({});
      await renderRouter(routes, { initialUrl: "/edit-profile" });

      await type("a!");

      expect(await screen.findByText(/letras, números, punto y guion bajo/)).toBeVisible();
      expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
      expect(calls).toEqual([]);
    });

    it("a 409 on save is shown inline and keeps what was typed", async () => {
      mockApi({
        "GET /usernames/cami": json(200, { available: true, username: "cami" }),
        "PATCH /me": json(409, { error: "Ese nombre de usuario ya está en uso." }),
      });
      await renderRouter(routes, { initialUrl: "/edit-profile" });

      await type("cami");
      await screen.findByText("Disponible");
      await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));

      expect(await screen.findByText("Ese nombre de usuario ya está en uso.")).toBeVisible();
      expect(screen.getByLabelText("Nombre de usuario").props.value).toBe("cami");
      expect(screen).toHavePathname("/edit-profile");
    });
  });

  it("can't save an empty name", async () => {
    await renderRouter(routes, { initialUrl: "/edit-profile" });

    await fireEvent.changeText(await screen.findByLabelText("Tu nombre"), "   ");

    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("shows the server's error inline and leaves the sheet open", async () => {
    mockApi({ "PATCH /me": json(400, { error: "El nombre es muy largo" }) });
    await renderRouter(routes, { initialUrl: "/edit-profile" });

    await fireEvent.changeText(await screen.findByLabelText("Tu nombre"), "Juan");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("El nombre es muy largo")).toBeVisible();
    expect(screen).toHavePathname("/edit-profile");
  });

  describe("photo", () => {
    const asset = { uri: "file:///picked.jpg", width: 1200, height: 1200 } as ImagePicker.ImagePickerAsset;
    const choose = async (index: number) => {
      await fireEvent.press(await screen.findByRole("button", { name: "Foto de perfil" }));
      const onSelect = sheet.mock.calls[0]![1] as (i: number) => void;
      await act(async () => onSelect(index));
    };

    const cropped = { uri: "file:///cache/cropped.jpg", width: 512, height: 512 };

    it("opens the fast library picker (no native editing) and then our own crop screen", async () => {
      picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [asset] });
      const upload = jest.spyOn(profileActions, "uploadAvatar").mockResolvedValue(USER);
      upload.mockClear();
      await renderRouter(routes, { initialUrl: "/edit-profile" });

      await choose(1);

      expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: false }));
      await waitFor(() => expect(screen).toHavePathname("/crop-avatar"));
      expect(screen.getByRole("button", { name: "Elegir" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Cancelar" })).toBeVisible();
      expect(upload).not.toHaveBeenCalled();
    });

    it("Elegir crops the square under the circle to 512×512 and uploads it", async () => {
      const tall = { uri: "file:///picked.jpg", width: 1200, height: 1600 } as ImagePicker.ImagePickerAsset;
      picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [tall] });
      const upload = jest.spyOn(profileActions, "uploadAvatar").mockResolvedValue({ ...USER, avatarUrl: "/avatars/u1/a.jpg" });
      upload.mockClear();
      manipulator.ImageManipulator.manipulate.mockClear();
      await renderRouter(routes, { initialUrl: "/edit-profile" });

      await choose(1);
      await fireEvent.press(await screen.findByRole("button", { name: "Elegir" }));

      await waitFor(() => expect(upload).toHaveBeenCalledWith(cropped));
      expect(manipulator.ImageManipulator.manipulate).toHaveBeenCalledWith("file:///picked.jpg");
      expect(manipulator.ImageManipulator.__ctx.crop).toHaveBeenLastCalledWith({ originX: 0, originY: 200, width: 1200, height: 1200 });
      expect(manipulator.ImageManipulator.__ctx.resize).toHaveBeenLastCalledWith({ width: 512, height: 512 });
      await waitFor(() => expect(screen).toHavePathname("/edit-profile"));
    });

    it("a library photo without a size skips the crop screen and uploads as is", async () => {
      const sizeless = { uri: "file:///picked.jpg", width: 0, height: 0 } as ImagePicker.ImagePickerAsset;
      picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [sizeless] });
      const upload = jest.spyOn(profileActions, "uploadAvatar").mockResolvedValue(USER);
      upload.mockClear();
      await renderRouter(routes, { initialUrl: "/edit-profile" });

      await choose(1);

      await waitFor(() => expect(upload).toHaveBeenCalledWith(sizeless));
      expect(screen).toHavePathname("/edit-profile");
    });

    it("Cancelar on the crop screen goes back and uploads nothing", async () => {
      picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [asset] });
      const upload = jest.spyOn(profileActions, "uploadAvatar");
      upload.mockClear();
      await renderRouter(routes, { initialUrl: "/edit-profile" });

      await choose(1);
      await fireEvent.press(await screen.findByRole("button", { name: "Cancelar" }));

      await waitFor(() => expect(screen).toHavePathname("/edit-profile"));
      expect(upload).not.toHaveBeenCalled();
    });

    it("takes a photo with the camera (asking for permission first)", async () => {
      picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as ImagePicker.PermissionResponse);
      picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [asset] });
      const upload = jest.spyOn(profileActions, "uploadAvatar").mockResolvedValue(USER);
      await renderRouter(routes, { initialUrl: "/edit-profile" });

      await choose(0);

      expect(picker.launchCameraAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: true, aspect: [1, 1] }));
      // The camera keeps its native square crop: no crop screen after it.
      await waitFor(() => expect(upload).toHaveBeenCalledWith(asset));
      expect(screen).toHavePathname("/edit-profile");
    });

    it("shows the local photo with a spinner until it confirms, and Guardar waits", async () => {
      picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [asset] });
      let finish!: (u: typeof USER) => void;
      jest.spyOn(profileActions, "uploadAvatar").mockReturnValue(new Promise((resolve) => (finish = resolve)));
      await renderRouter(routes, { initialUrl: "/edit-profile" });

      await choose(1);
      await fireEvent.press(await screen.findByRole("button", { name: "Elegir" }));

      expect(await screen.findByTestId("avatar-image", { includeHiddenElements: true })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
      await act(async () => finish({ ...USER, avatarUrl: "/avatars/u1/a.jpg" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled());
    });

    it("if the upload fails it says so inline and can retry", async () => {
      picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [asset] });
      const upload = jest
        .spyOn(profileActions, "uploadAvatar")
        .mockRejectedValueOnce(new Error("No se pudo subir la foto. Probá de nuevo."))
        .mockResolvedValueOnce({ ...USER, avatarUrl: "/avatars/u1/a.jpg" });
      upload.mockClear();
      await renderRouter(routes, { initialUrl: "/edit-profile" });

      await choose(1);
      await fireEvent.press(await screen.findByRole("button", { name: "Elegir" }));
      expect(await screen.findByText("No se pudo subir la foto. Probá de nuevo.")).toBeVisible();

      await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));

      await waitFor(() => expect(screen.queryByText("No se pudo subir la foto. Probá de nuevo.")).toBeNull());
      expect(upload).toHaveBeenCalledTimes(2);
    });

    it("cancelling the picker changes nothing", async () => {
      picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
      const upload = jest.spyOn(profileActions, "uploadAvatar");
      upload.mockClear();
      await renderRouter(routes, { initialUrl: "/edit-profile" });

      await choose(1);

      expect(upload).not.toHaveBeenCalled();
    });
  });
});

describe("Perfil", () => {
  beforeEach(() => signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] }));

  it("shows your handle under your name and the members' under theirs", async () => {
    await renderRouter(routes, { initialUrl: "/me" });

    expect(await screen.findByText("@fede.s")).toBeVisible();
    expect(screen.getAllByText("@juani")).toHaveLength(2);
  });
});

describe("Join", () => {
  beforeEach(() => signInAs({ trips: [] }));

  it("only asks for the code", async () => {
    await renderRouter(routes, { initialUrl: "/join" });

    expect(await screen.findByLabelText("Código del rollo")).toBeVisible();
    expect(screen.queryByLabelText("Tu nombre")).toBeNull();
  });

  it("shows the server's message when the profile has no name", async () => {
    mocked.joinTrip.mockRejectedValue(new Error("Completá tu nombre en el perfil"));
    await renderRouter(routes, { initialUrl: "/join" });

    await fireEvent.changeText(await screen.findByLabelText("Código del rollo"), "HUB5FT");
    await fireEvent.press(screen.getByRole("button", { name: "Unirme" }));

    expect(await screen.findByText("Completá tu nombre en el perfil")).toBeVisible();
  });

  it("shows the server's message when the profile has no username", async () => {
    mocked.joinTrip.mockRejectedValue(new Error("Elegí tu nombre de usuario en el perfil"));
    await renderRouter(routes, { initialUrl: "/join" });

    await fireEvent.changeText(await screen.findByLabelText("Código del rollo"), "HUB5FT");
    await fireEvent.press(screen.getByRole("button", { name: "Unirme" }));

    expect(await screen.findByText("Elegí tu nombre de usuario en el perfil")).toBeVisible();
  });
});
