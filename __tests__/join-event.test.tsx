import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as actions from "@/features/trips/actions";
import { markAppIntroPending } from "@/storage/app-intro";
import { getPendingJoin, setPendingJoin } from "@/storage/pending-join";
import { markPushPrimerSeen } from "@/storage/push-primer";
import { signInAs, USER } from "@/test/account";
import "@/test/reanimated";
import { routes } from "@/test/routes";
import { setSessionToken } from "@/storage/session";
import { queryClient } from "@/api/query-client";
import { meKey } from "@/features/auth/actions";

jest.mock("@/features/trips/actions");
const mocked = jest.mocked(actions);

const preview = (over: Partial<actions.EventPreview> = {}): actions.EventPreview => ({
  name: "Casamiento de Cami",
  coverUrl: null,
  revealed: false,
  groups: [
    { id: "g1", name: "Familia" },
    { id: "g2", name: "Amigos" },
  ],
  ...over,
});

const enterCode = async (code = "abc123") => {
  await fireEvent.changeText(await screen.findByLabelText("Código del rollo"), code);
  await fireEvent.press(screen.getByRole("button", { name: "Unirme" }));
};

beforeEach(() => {
  for (const mock of Object.values(mocked)) (mock as Partial<jest.Mock>).mockReset?.();
  mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
});

describe("Joining an event", () => {
  beforeEach(async () => {
    await signInAs({ trips: [] });
    await markPushPrimerSeen();
  });

  it("entering an event code shows its groups and joins the chosen ones", async () => {
    mocked.previewEvent.mockResolvedValue(preview());
    mocked.joinTrip.mockResolvedValue({} as actions.Trip);
    await renderRouter(routes, { initialUrl: "/join" });

    await enterCode();

    expect(await screen.findByText("Casamiento de Cami")).toBeVisible();
    expect(screen.getByText("Elegí tus grupos")).toBeVisible();
    expect(mocked.joinTrip).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Amigos" }));
    await fireEvent.press(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(mocked.joinTrip).toHaveBeenCalledWith({ code: "ABC123", groupIds: ["g2"] }));
    await waitFor(() => expect(screen).toHavePathname("/roll"));
  });

  it("asks for a single group when the event has just one", async () => {
    mocked.previewEvent.mockResolvedValue(preview({ groups: [{ id: "g1", name: "Familia" }] }));
    await renderRouter(routes, { initialUrl: "/join" });

    await enterCode();

    expect(await screen.findByText("Elegí tu grupo")).toBeVisible();
  });

  it("Entrar is disabled until a group is picked", async () => {
    mocked.previewEvent.mockResolvedValue(preview());
    await renderRouter(routes, { initialUrl: "/join" });

    await enterCode();
    const enter = await screen.findByRole("button", { name: "Entrar" });
    expect(enter).toBeDisabled();

    await fireEvent.press(screen.getByRole("button", { name: "Familia" }));
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    await fireEvent.press(screen.getByRole("button", { name: "Familia" }));
    expect(screen.getByRole("button", { name: "Entrar" })).toBeDisabled();
  });

  it("a regular trip code joins directly", async () => {
    mocked.previewEvent.mockResolvedValue(null);
    mocked.joinTrip.mockResolvedValue({} as actions.Trip);
    await renderRouter(routes, { initialUrl: "/join" });

    await enterCode("hub5ft");

    await waitFor(() => expect(mocked.joinTrip).toHaveBeenCalledWith({ code: "HUB5FT" }));
    await waitFor(() => expect(screen).toHavePathname("/roll"));
  });

  it("a failing preview still joins a regular trip", async () => {
    mocked.previewEvent.mockRejectedValue(new Error("Sin conexión"));
    mocked.joinTrip.mockResolvedValue({} as actions.Trip);
    await renderRouter(routes, { initialUrl: "/join" });

    await enterCode("hub5ft");

    await waitFor(() => expect(mocked.joinTrip).toHaveBeenCalledWith({ code: "HUB5FT" }));
    await waitFor(() => expect(screen).toHavePathname("/roll"));
  });

  it("a join error clears when the code changes", async () => {
    mocked.previewEvent.mockResolvedValue(null);
    mocked.joinTrip.mockRejectedValue(new Error("Código inválido"));
    await renderRouter(routes, { initialUrl: "/join" });

    await enterCode("zzzzzz");
    expect(await screen.findByText("Código inválido")).toBeVisible();
    await fireEvent.changeText(screen.getByLabelText("Código del rollo"), "zzzzz");
    expect(screen.queryByText("Código inválido")).toBeNull();
  });

  it('a revealed event shows "Este evento ya se reveló." and no groups', async () => {
    mocked.previewEvent.mockResolvedValue(preview({ revealed: true }));
    await renderRouter(routes, { initialUrl: "/join" });

    await enterCode();

    expect(await screen.findByText("Este evento ya se reveló.")).toBeVisible();
    expect(screen.queryByText("Familia")).toBeNull();
    expect(mocked.joinTrip).not.toHaveBeenCalled();
  });

  it("prefills the code from the link", async () => {
    await renderRouter(routes, { initialUrl: "/join?code=ABC123" });

    expect((await screen.findByLabelText("Código del rollo")).props.value).toBe("ABC123");
  });
});

describe("A join link without a session", () => {
  it("is kept and opened after the profile is complete", async () => {
    await renderRouter(routes, { initialUrl: "/join?code=ABC123" });

    await waitFor(() => expect(screen).toHavePathname("/welcome"));
    expect(await getPendingJoin()).toEqual({ code: "ABC123" });

    // The profile gets completed: the pending link opens the join screen with the code.
    await setSessionToken("session-token");
    queryClient.setQueryData(meKey, USER);
    await signInAs({ trips: [] });
    await markPushPrimerSeen();
    await renderRouter(routes, { initialUrl: "/" });

    await waitFor(() => expect(screen).toHavePathname("/join"));
    expect((await screen.findByLabelText("Código del rollo")).props.value).toBe("ABC123");
    expect(await getPendingJoin()).toBeNull();
  });
});

describe("A pending join and the new-account intro", () => {
  it("a new account arriving by link sees the intro first and then the join screen", async () => {
    mocked.fetchMyTrips.mockResolvedValue({ trips: [] });
    await signInAs({ trips: [] });
    await markPushPrimerSeen();
    await markAppIntroPending();
    await setPendingJoin({ code: "ABC123" });
    await renderRouter(routes, { initialUrl: "/" });

    expect(await screen.findByText("Sacá la foto.")).toBeVisible();
    expect(screen).toHavePathname("/intro");
    expect(await getPendingJoin()).toEqual({ code: "ABC123" });

    await fireEvent.press(await screen.findByRole("button", { name: "Empezar" }, { timeout: 4000 }));
    await waitFor(() => expect(screen).toHavePathname("/join"));
    expect((await screen.findByLabelText("Código del rollo")).props.value).toBe("ABC123");
    expect(await getPendingJoin()).toBeNull();
  });

  it("a pending join older than 24 hours is dropped", async () => {
    const now = Date.now();
    await setPendingJoin({ code: "ABC123" }, now - 25 * 60 * 60 * 1000);
    expect(await getPendingJoin(now)).toBeNull();
    await setPendingJoin({ code: "ABC123" }, now - 60 * 60 * 1000);
    expect(await getPendingJoin(now)).toEqual({ code: "ABC123" });
  });
});
