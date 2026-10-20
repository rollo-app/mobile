import * as ImagePicker from "expo-image-picker";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { ActionSheetIOS, Alert } from "react-native";
import { createQueue } from "@/features/capture/queue";
import * as profileActions from "@/features/profile/actions";
import * as actions from "@/features/trips/actions";
import { getSessionToken } from "@/storage/session";
import { signInAs, tripSummary, USER } from "@/test/account";
import { memoryDb } from "@/test/sqlite-memory";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("expo-image-picker");
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
  },
  me: { id: "m1", userId: "u1", name: "Juani", username: null, avatarUrl: null, role: "admin" },
  members: [
    { id: "m1", userId: "u1", name: "Juani", username: "juani", avatarUrl: null, role: "admin" },
    { id: "m2", userId: "u2", name: "Fede", username: "fede.s", avatarUrl: null, role: "member" },
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
    expect(screen.getByRole("button", { name: /^Reenviar código/ })).toBeDisabled();
    await fireEvent.changeText(code, "123456");

    expect(await screen.findByText("Completá tu perfil")).toBeVisible();
    expect(await getSessionToken()).toBe("tok");
    expect(screen.getByRole("button", { name: "Listo" })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText("Tu nombre"), "Juani");
    expect(screen.getByLabelText("Nombre de usuario").props.value).toBe("juani");
    expect(await screen.findByText("Disponible")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }));

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
    await fireEvent.changeText(await screen.findByLabelText("Código"), "123456");

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
    await fireEvent.changeText(await screen.findByLabelText("Código"), "123456");

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

    await fireEvent.changeText(await screen.findByLabelText("Código"), "000000");

    expect(await screen.findByText("Código incorrecto o vencido")).toBeVisible();
    expect(await getSessionToken()).toBeNull();
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

describe("Profile tab", () => {
  beforeEach(() => signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] }));

  it("shows your name and email, and the active roll", async () => {
    await renderRouter(routes, { initialUrl: "/me" });

    expect(await screen.findByText("juani@rollo.test")).toBeVisible();
    expect(screen.getAllByText("Juani").length).toBeGreaterThan(0);
    expect(await screen.findByRole("button", { name: "Viaje al sur, Admin" })).toBeVisible();
  });

  it("log out tells the server, lands on the login and keeps the pending photos", async () => {
    const queue = await createQueue(memoryDb());
    getQueue.mockImplementation(() => Promise.resolve(queue));
    await queue.enqueue({
      id: "q1", tripId: SUR, type: "photo", takenAt: 1, day: "2027-01-12", lat: null, lng: null, accuracyM: null,
      caption: null, durationS: null, width: 1, height: 1, sizeBytes: 1,
      originalUri: "file:///docs/pending/q1/original.jpg", thumbUri: "file:///docs/pending/q1/thumb.jpg", thumbhash: null,
    });
    const calls = mockApi({ "POST /auth/logout": json(204) });
    await renderRouter(routes, { initialUrl: "/me" });

    await fireEvent.press(await screen.findByRole("button", { name: "Cerrar sesión" }));

    expect(await screen.findByLabelText("Tu email")).toBeVisible();
    expect(calls).toContain("POST /auth/logout");
    expect(await getSessionToken()).toBeNull();
    expect(await queue.pending()).toHaveLength(1);
  });

  it("delete account asks for a native confirmation with the destructive warning", async () => {
    const calls = mockApi({ "DELETE /me": json(204) });
    await renderRouter(routes, { initialUrl: "/me" });

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
    await renderRouter(routes, { initialUrl: "/me" });
    await fireEvent.press(await screen.findByRole("button", { name: "Borrar cuenta" }));

    const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === "Borrar cuenta")!.onPress!());

    expect(await screen.findByLabelText("Tu email")).toBeVisible();
    expect(calls).toEqual(["DELETE /me"]);
    expect(await getSessionToken()).toBeNull();
  });

  it("if deleting fails it shows the error inline and keeps the session", async () => {
    mockApi({ "DELETE /me": json(500, { error: "No se pudo borrar la cuenta" }) });
    await renderRouter(routes, { initialUrl: "/me" });
    await fireEvent.press(await screen.findByRole("button", { name: "Borrar cuenta" }));

    const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === "Borrar cuenta")!.onPress!());

    expect(await screen.findByText("No se pudo borrar la cuenta")).toBeVisible();
    expect(await getSessionToken()).toBe("session-token");
  });
});

describe("Edit profile", () => {
  beforeEach(() => signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] }));

  it("opens from Perfil with your name, and saving closes the sheet and updates the profile", async () => {
    const calls = mockApi({ "PATCH /me": json(200, { ...USER, name: "Juan" }) });
    await renderRouter(routes, { initialUrl: "/me" });

    await fireEvent.press(await screen.findByRole("button", { name: "Editar perfil" }));
    const input = await screen.findByLabelText("Tu nombre");
    expect(input.props.value).toBe("Juani");
    await fireEvent.changeText(input, "Juan");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen).toHavePathname("/me"));
    expect(calls).toEqual(["PATCH /me"]);
    expect(await screen.findAllByText("Juan")).not.toHaveLength(0);
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
      await fireEvent.press(await screen.findByRole("button", { name: "Editar perfil" }));

      await type("@Juani.F");
      expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
      expect(await screen.findByText("Disponible")).toBeVisible();
      expect(calls).toEqual(["GET /usernames/juani.f"]);
      await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));

      await waitFor(() => expect(screen).toHavePathname("/me"));
      expect(calls).toEqual(["GET /usernames/juani.f", "PATCH /me"]);
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

    it("picks from the library with the native 1:1 crop and uploads it", async () => {
      picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [asset] });
      const upload = jest.spyOn(profileActions, "uploadAvatar").mockResolvedValue({ ...USER, avatarUrl: "/avatars/u1/a.jpg" });
      await renderRouter(routes, { initialUrl: "/edit-profile" });

      await choose(1);

      expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: true, aspect: [1, 1] }));
      await waitFor(() => expect(upload).toHaveBeenCalledWith(asset));
    });

    it("takes a photo with the camera (asking for permission first)", async () => {
      picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as ImagePicker.PermissionResponse);
      picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [asset] });
      const upload = jest.spyOn(profileActions, "uploadAvatar").mockResolvedValue(USER);
      await renderRouter(routes, { initialUrl: "/edit-profile" });

      await choose(0);

      expect(picker.launchCameraAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: true, aspect: [1, 1] }));
      await waitFor(() => expect(upload).toHaveBeenCalled());
    });

    it("shows the local photo with a spinner until it confirms, and Guardar waits", async () => {
      picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [asset] });
      let finish!: (u: typeof USER) => void;
      jest.spyOn(profileActions, "uploadAvatar").mockReturnValue(new Promise((resolve) => (finish = resolve)));
      await renderRouter(routes, { initialUrl: "/edit-profile" });

      await choose(1);

      expect(screen.getByTestId("avatar-image", { includeHiddenElements: true })).toBeTruthy();
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
