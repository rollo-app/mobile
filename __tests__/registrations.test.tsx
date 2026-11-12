import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import { router } from "expo-router";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Keyboard, Linking } from "react-native";
import "@/test/reanimated";
import { forgetMagicLinks } from "@/features/auth/magic-link";
import { setLoginLinkVerifier } from "@/storage/login-link-verifier";
import { getSessionToken } from "@/storage/session";
import { routes } from "@/test/routes";

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type Handler = () => Response | Promise<Response>;

/** Routes `fetch` by "METHOD /path"; anything else is a 404. Returns the calls made, with their bodies. */
function mockApi(handlers: Record<string, Handler>) {
  const calls: { key: string; body: unknown }[] = [];
  globalThis.fetch = jest.fn(async (req: Request) => {
    const key = `${req.method} ${new URL(req.url).pathname}`;
    const text = req.method === "GET" ? "" : await req.clone().text();
    calls.push({ key, body: text ? JSON.parse(text) : undefined });
    const handler = handlers[key];
    return handler ? handler() : json(404, { error: `sin ruta ${key}` });
  }) as unknown as typeof fetch;
  return calls;
}

const CLOSED_MESSAGE = "Por ahora no estamos sumando cuentas nuevas. Anotate en la lista y te avisamos cuando abramos.";
const closedBody = { error: CLOSED_MESSAGE, code: "REGISTRATIONS_CLOSED" };
const OPEN = () => json(200, { registrationsOpen: true });
const CLOSED = () => json(200, { registrationsOpen: false });

describe("Welcome screen", () => {
  it("with registrations open: Crear cuenta and Ya tengo cuenta both go to the email screen", async () => {
    mockApi({ "GET /config": OPEN });
    await renderRouter(routes, { initialUrl: "/welcome" });

    expect(await screen.findByText("Rollo")).toBeVisible();
    expect(screen.getByText("Sacá fotos con tu grupo y mirálas todas juntas al final, como un rollo.")).toBeVisible();
    expect(screen.queryByLabelText("Tu email")).toBeNull();
    await fireEvent.press(await screen.findByRole("button", { name: "Crear cuenta" }));
    await waitFor(() => expect(screen).toHavePathname("/email"));
    expect(await screen.findByLabelText("Tu email")).toBeVisible();

    await act(() => router.back());
    await fireEvent.press(await screen.findByRole("button", { name: "Ya tengo cuenta" }));
    await waitFor(() => expect(screen).toHavePathname("/email"));
  });

  it("tapping the screen outside the field hides the keyboard", async () => {
    mockApi({ "GET /config": CLOSED });
    const dismiss = jest.spyOn(Keyboard, "dismiss");
    await renderRouter(routes, { initialUrl: "/welcome" });

    await fireEvent.press(await screen.findByText("Rollo"));
    expect(dismiss).toHaveBeenCalled();
    dismiss.mockRestore();
  });

  it("a logged-out user opening the app lands on it", async () => {
    mockApi({ "GET /config": OPEN });
    await renderRouter(routes, { initialUrl: "/" });

    expect(await screen.findByRole("button", { name: "Crear cuenta" })).toBeVisible();
    expect(screen).toHavePathname("/welcome");
  });

  it("when /config fails it acts as open: nobody gets blocked", async () => {
    mockApi({ "GET /config": () => json(500, { error: "boom" }) });
    await renderRouter(routes, { initialUrl: "/welcome" });

    expect(await screen.findByRole("button", { name: "Crear cuenta" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Ya tengo cuenta" })).toBeVisible();
    await waitFor(() => expect(screen.queryByText(/Estamos abriendo Rollo/)).toBeNull());
  });

  it("when offline it acts as open", async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;
    await renderRouter(routes, { initialUrl: "/welcome" });

    expect(await screen.findByRole("button", { name: "Crear cuenta" })).toBeVisible();
  });

  describe("with registrations closed", () => {
    it("shows the waitlist form instead of Crear cuenta, and Ya tengo cuenta still goes to the email screen", async () => {
      mockApi({ "GET /config": CLOSED });
      await renderRouter(routes, { initialUrl: "/welcome" });

      expect(await screen.findByText("Estamos abriendo Rollo de a poco. Dejanos tu email y te avisamos cuando puedas entrar.")).toBeVisible();
      expect(screen.queryByRole("button", { name: "Crear cuenta" })).toBeNull();
      expect(screen.getByLabelText("Email")).toBeVisible();
      expect(screen.getByRole("checkbox", { name: "Acepto que me escriban para avisarme cuando Rollo abra." })).toBeVisible();

      await fireEvent.press(screen.getByRole("button", { name: "Ya tengo cuenta" }));
      await waitFor(() => expect(screen).toHavePathname("/email"));
    });

    it("Avisarme needs a valid email and the consent", async () => {
      const calls = mockApi({ "GET /config": CLOSED, "POST /waitlist": () => json(204) });
      await renderRouter(routes, { initialUrl: "/welcome" });

      const button = await screen.findByRole("button", { name: "Avisarme" });
      expect(button).toBeDisabled();
      await fireEvent.changeText(screen.getByLabelText("Email"), "lucia@rollo.test");
      expect(screen.getByRole("button", { name: "Avisarme" })).toBeDisabled();
      await fireEvent(screen.getByRole("checkbox", { name: /Acepto que me escriban/ }), "press");
      expect(screen.getByRole("button", { name: "Avisarme" })).toBeEnabled();
      await fireEvent(screen.getByRole("checkbox", { name: /Acepto que me escriban/ }), "press");
      expect(screen.getByRole("button", { name: "Avisarme" })).toBeDisabled();
      expect(calls.some((c) => c.key === "POST /waitlist")).toBe(false);
    });

    it("sends the email with the consent and replaces the form with the confirmation", async () => {
      const calls = mockApi({ "GET /config": CLOSED, "POST /waitlist": () => json(204) });
      await renderRouter(routes, { initialUrl: "/welcome" });

      await fireEvent.changeText(await screen.findByLabelText("Email"), " Lucia@Rollo.test ");
      await fireEvent(screen.getByRole("checkbox", { name: /Acepto que me escriban/ }), "press");
      await fireEvent.press(screen.getByRole("button", { name: "Avisarme" }));

      expect(await screen.findByText("¡Listo! Te mandamos un mail para confirmar.")).toBeVisible();
      expect(calls.find((c) => c.key === "POST /waitlist")?.body).toEqual({ email: "lucia@rollo.test", source: "app", consent: true });
      expect(screen.queryByLabelText("Email")).toBeNull();
      expect(screen.queryByRole("button", { name: "Avisarme" })).toBeNull();
      expect(screen.getByRole("button", { name: "Ya tengo cuenta" })).toBeVisible();
    });

    it("shows the server's 400 inline and keeps the form", async () => {
      mockApi({ "GET /config": CLOSED, "POST /waitlist": () => json(400, { error: "Ese email no parece válido." }) });
      await renderRouter(routes, { initialUrl: "/welcome" });

      await fireEvent.changeText(await screen.findByLabelText("Email"), "lucia@rollo.test");
      await fireEvent(screen.getByRole("checkbox", { name: /Acepto que me escriban/ }), "press");
      await fireEvent.press(screen.getByRole("button", { name: "Avisarme" }));

      expect(await screen.findByText("Ese email no parece válido.")).toBeVisible();
      expect(screen.getByLabelText("Email").props.value).toBe("lucia@rollo.test");
      expect(screen.queryByText("¡Listo! Te mandamos un mail para confirmar.")).toBeNull();
    });

    it("the privacy policy link opens the site", async () => {
      const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
      mockApi({ "GET /config": CLOSED });
      await renderRouter(routes, { initialUrl: "/welcome" });

      await fireEvent.press(await screen.findByText("Ver política de privacidad"));
      expect(open).toHaveBeenLastCalledWith("https://rolloproject.com/privacy");
      open.mockRestore();
    });
  });
});

describe("Registrations closed when creating an account", () => {
  /** Closed in /config too, so the welcome screen it goes back to shows the waitlist form. */
  const closedApi = (extra: Record<string, Handler>) => mockApi({ "GET /config": CLOSED, ...extra });

  async function expectBackOnWaitlist() {
    await fireEvent.press(await screen.findByRole("button", { name: "Anotarme en la lista" }));
    await waitFor(() => expect(screen).toHavePathname("/welcome"));
    expect(await screen.findByText(/Estamos abriendo Rollo de a poco/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Avisarme" })).toBeVisible();
    expect(await getSessionToken()).toBeNull();
  }

  it("the code screen shows the server's message and Anotarme en la lista goes to the welcome screen", async () => {
    // Registrations were open when the welcome screen was read: the config is refetched on the way back.
    let closed = false;
    closedApi({
      "GET /config": () => (closed ? CLOSED() : OPEN()),
      "POST /auth/email/start": () => json(204),
      "POST /auth/email/verify": () => {
        closed = true;
        return json(403, closedBody);
      },
    });
    await renderRouter(routes, { initialUrl: "/welcome" });

    await fireEvent.press(await screen.findByRole("button", { name: "Crear cuenta" }));
    await fireEvent.changeText(await screen.findByLabelText("Tu email"), "lucia@rollo.test");
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));
    await fireEvent.changeText(await screen.findByLabelText("Código"), "K7M4QX");

    expect(await screen.findByText(CLOSED_MESSAGE)).toBeVisible();
    expect(screen.queryByText("Si el mail se borró, pedí otro código.")).toBeNull();
    await expectBackOnWaitlist();
  });

  it("the magic link screen shows the message and Anotarme en la lista goes to the welcome screen", async () => {
    forgetMagicLinks();
    await setLoginLinkVerifier({ email: "lucia@rollo.test", verifier: "v".repeat(43) });
    closedApi({ "POST /auth/email/verify-link": () => json(403, closedBody) });
    await renderRouter(routes, { initialUrl: "/login?token=tk1&email=lucia%40rollo.test" });

    expect(await screen.findByText(CLOSED_MESSAGE)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Volver a pedir un código" })).toBeNull();
    await expectBackOnWaitlist();
  });

  it("Continuar con Google shows the message and Anotarme en la lista goes to the welcome screen", async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({
      type: "success",
      data: { idToken: "gtok", serverAuthCode: null, scopes: [], user: { id: "g1", name: null, email: "x@gmail.com", photo: null, familyName: null, givenName: null } },
    });
    closedApi({ "POST /auth/google": () => json(403, closedBody) });
    await renderRouter(routes, { initialUrl: "/email" });

    await fireEvent.press(await screen.findByRole("button", { name: "Continuar con Google" }));

    expect(await screen.findByText(CLOSED_MESSAGE)).toBeVisible();
    await expectBackOnWaitlist();
  });

  describe("Continuar con Apple", () => {
    const config = Constants.expoConfig as { ios?: Record<string, unknown> };
    const before = config.ios;
    beforeEach(() => {
      config.ios = { ...before, usesAppleSignIn: true };
    });
    afterEach(() => {
      config.ios = before;
    });

    it("shows the message and Anotarme en la lista goes to the welcome screen", async () => {
      jest.mocked(AppleAuthentication.signInAsync).mockResolvedValueOnce({
        user: "a1",
        identityToken: "atok",
        fullName: null,
        email: null,
        realUserStatus: 1,
        state: null,
        authorizationCode: null,
      } as AppleAuthentication.AppleAuthenticationCredential);
      closedApi({ "POST /auth/apple": () => json(403, closedBody) });
      await renderRouter(routes, { initialUrl: "/email" });

      await fireEvent.press(await screen.findByRole("button", { name: "Continuar con Apple" }));

      expect(await screen.findByText(CLOSED_MESSAGE)).toBeVisible();
      await expectBackOnWaitlist();
    });
  });

  it("a 403 without that code is a plain error: no waitlist button", async () => {
    closedApi({ "POST /auth/email/start": () => json(204), "POST /auth/email/verify": () => json(403, { error: "No permitido" }) });
    await renderRouter(routes, { initialUrl: "/email" });

    await fireEvent.changeText(await screen.findByLabelText("Tu email"), "lucia@rollo.test");
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));
    await fireEvent.changeText(await screen.findByLabelText("Código"), "K7M4QX");

    expect(await screen.findByText("No permitido")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Anotarme en la lista" })).toBeNull();
  });
});
