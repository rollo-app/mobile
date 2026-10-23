import { router } from "expo-router";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { forgetMagicLinks } from "@/features/auth/magic-link";
import * as featuredActions from "@/features/featured/actions";
import * as friendActions from "@/features/friends/actions";
import * as moderationActions from "@/features/moderation/actions";
import * as tripActions from "@/features/trips/actions";
import { getSessionToken } from "@/storage/session";
import { signInAs, USER } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/featured/actions");
jest.mock("@/features/friends/actions");
jest.mock("@/features/moderation/actions");

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Routes `fetch` by "METHOD /path"; anything else is a 404. Returns the calls made, with their bodies. */
function mockApi(handlers: Record<string, () => Response | Promise<Response>>) {
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
const verifyCalls = (calls: { key: string }[]) => calls.filter((c) => c.key === "POST /auth/email/verify-link");

const link = (token: string, email: string) => `/login?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
const DEAD = "El link venció o ya se usó. Pedí otro código.";

beforeEach(() => {
  forgetMagicLinks();
  jest.mocked(tripActions).fetchMyTrips.mockResolvedValue({ trips: [] });
  jest.mocked(featuredActions).fetchFeatured.mockResolvedValue([]);
  jest.mocked(friendActions).fetchFriends.mockResolvedValue([]);
  jest.mocked(moderationActions).fetchBlocked.mockResolvedValue([]);
});

describe("Opening the magic link from the email", () => {
  describe("without a session", () => {
    it("signs in with the link and the app opens, like with the code", async () => {
      const calls = mockApi({ "POST /auth/email/verify-link": () => json(200, { token: "tok", user: USER, isNew: false }) });
      await renderRouter(routes, { initialUrl: link("tk1", "juani@rollo.test") });

      expect(await screen.findByText("Todavía no tenés rollos")).toBeVisible();
      expect(screen).toHavePathname("/roll");
      expect(await getSessionToken()).toBe("tok");
      expect(verifyCalls(calls)).toEqual([{ key: "POST /auth/email/verify-link", body: { email: "juani@rollo.test", token: "tk1" } }]);
    });

    it("a new account goes on to Completá tu perfil", async () => {
      mockApi({
        "POST /auth/email/verify-link": () => json(200, { token: "tok", user: { ...USER, name: null, username: null }, isNew: true }),
      });
      await renderRouter(routes, { initialUrl: link("tk1", "juani@rollo.test") });

      expect(await screen.findByText("Completá tu perfil")).toBeVisible();
      expect(screen).toHavePathname("/profile");
    });

    it("shows that it's signing in while it checks the link", async () => {
      mockApi({ "POST /auth/email/verify-link": () => new Promise<Response>(() => {}) });
      await renderRouter(routes, { initialUrl: link("tk1", "juani@rollo.test") });

      expect(await screen.findByText("Entrando…")).toBeVisible();
    });

    it("a dead link shows the message and goes back to ask for a code with the email filled in", async () => {
      mockApi({ "POST /auth/email/verify-link": () => json(400, { error: DEAD }) });
      await renderRouter(routes, { initialUrl: link("tk1", "Juani@Rollo.test") });

      expect(await screen.findByText(DEAD)).toBeVisible();
      expect(await getSessionToken()).toBeNull();

      await fireEvent.press(screen.getByRole("button", { name: "Volver a pedir un código" }));

      await waitFor(() => expect(screen).toHavePathname("/email"));
      expect(screen.getByLabelText("Tu email").props.value).toBe("juani@rollo.test");
    });

    it("a link without a token says it isn't valid, without asking the server", async () => {
      const calls = mockApi({});
      await renderRouter(routes, { initialUrl: "/login" });

      expect(await screen.findByText("Este link no es válido. Pedí un código nuevo desde la app.")).toBeVisible();
      expect(verifyCalls(calls)).toHaveLength(0);

      await fireEvent.press(screen.getByRole("button", { name: "Volver a pedir un código" }));
      await waitFor(() => expect(screen).toHavePathname("/email"));
    });

    it("opening the same link twice checks it only once", async () => {
      let answer!: (r: Response) => void;
      const calls = mockApi({ "POST /auth/email/verify-link": () => new Promise<Response>((resolve) => (answer = resolve)) });
      await renderRouter(routes, { initialUrl: link("tk1", "juani@rollo.test") });
      expect(await screen.findByText("Entrando…")).toBeVisible();

      await act(async () => router.push(link("tk1", "juani@rollo.test")));
      await act(async () => answer(json(200, { token: "tok", user: USER, isNew: false })));

      expect(await screen.findByText("Todavía no tenés rollos")).toBeVisible();
      expect(verifyCalls(calls)).toHaveLength(1);
    });
  });

  describe("with a session already", () => {
    beforeEach(() => signInAs({ trips: [] }));

    it("with the same email it just goes into the app", async () => {
      const calls = mockApi({});
      await renderRouter(routes, { initialUrl: link("tk1", "Juani@rollo.test") });

      expect(await screen.findByText("Todavía no tenés rollos")).toBeVisible();
      expect(verifyCalls(calls)).toHaveLength(0);
      expect(await getSessionToken()).toBe("session-token");
    });

    it("with a different email it doesn't switch accounts and offers to go on with this one", async () => {
      const calls = mockApi({});
      await renderRouter(routes, { initialUrl: link("tk1", "otro@rollo.test") });

      expect(await screen.findByText("Ya tenés la sesión iniciada con juani@rollo.test.")).toBeVisible();
      expect(verifyCalls(calls)).toHaveLength(0);

      await fireEvent.press(screen.getByRole("button", { name: "Seguir con esta cuenta" }));

      expect(await screen.findByText("Todavía no tenés rollos")).toBeVisible();
      expect(await getSessionToken()).toBe("session-token");
    });
  });
});
