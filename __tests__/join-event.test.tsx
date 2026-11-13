import { act } from "@testing-library/react-native";
import { router } from "expo-router";
import { ApiError } from "@/api/client";
import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
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

  it("shows the cover big with the event's name over it", async () => {
    mocked.previewEvent.mockResolvedValue(preview({ coverUrl: "/covers/e/c.jpg" }));
    await renderRouter(routes, { initialUrl: "/join" });

    await enterCode();

    const hero = await screen.findByTestId("event-hero");
    expect(within(hero).getByText("Casamiento de Cami")).toBeVisible();
    expect(within(hero).getByText("Te invitaron a")).toBeVisible();
    expect(screen.getByText("Elegí tus grupos")).toBeVisible();
  });

  it("without a cover the name is a plain title", async () => {
    mocked.previewEvent.mockResolvedValue(preview());
    await renderRouter(routes, { initialUrl: "/join" });

    await enterCode();

    expect(await screen.findByText("Casamiento de Cami")).toBeVisible();
    expect(screen.queryByTestId("event-hero")).toBeNull();
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

  it("looks the code from a link up by itself, once, and shows the groups", async () => {
    mocked.previewEvent.mockResolvedValue(preview());
    await renderRouter(routes, { initialUrl: "/join?code=abc123" });

    expect(await screen.findByText("Elegí tus grupos")).toBeVisible();
    expect(mocked.previewEvent).toHaveBeenCalledTimes(1);
    expect(mocked.previewEvent).toHaveBeenCalledWith("ABC123");
    expect(mocked.joinTrip).not.toHaveBeenCalled();
  });

  it("a link to a regular trip fills the code without joining by itself", async () => {
    mocked.previewEvent.mockResolvedValue(null);
    await renderRouter(routes, { initialUrl: "/join?code=HUB5FT" });

    await waitFor(() => expect(mocked.previewEvent).toHaveBeenCalledTimes(1));
    expect((await screen.findByLabelText("Código del rollo")).props.value).toBe("HUB5FT");
    expect(mocked.joinTrip).not.toHaveBeenCalled();
  });

  it("follows the code when the route param changes while mounted", async () => {
    mocked.previewEvent.mockResolvedValue(null);
    await renderRouter(routes, { initialUrl: "/join?code=ABC123" });
    await screen.findByLabelText("Código del rollo");

    await act(async () => router.setParams({ code: "ZZZ999" }));

    await waitFor(() => expect(screen.getByLabelText("Código del rollo").props.value).toBe("ZZZ999"));
    await waitFor(() => expect(mocked.previewEvent).toHaveBeenLastCalledWith("ZZZ999"));
  });

  describe("when the preview failed and the server asks to update", () => {
    const needsUpdate = () => new ApiError(409, "Actualizá Rollo para unirte a este evento.", undefined, "EVENT_NEEDS_UPDATE");

    it("retries the preview once and shows the groups instead of the message", async () => {
      mocked.previewEvent.mockRejectedValueOnce(new ApiError(429, "Demasiados pedidos")).mockResolvedValueOnce(preview());
      mocked.joinTrip.mockRejectedValue(needsUpdate());
      await renderRouter(routes, { initialUrl: "/join" });

      await enterCode();

      expect(await screen.findByText("Elegí tus grupos")).toBeVisible();
      expect(screen.queryByText(/Actualizá Rollo/)).toBeNull();
      expect(mocked.previewEvent).toHaveBeenCalledTimes(2);
    });

    it("shows the server message when the retry fails too", async () => {
      mocked.previewEvent.mockRejectedValue(new ApiError(429, "Demasiados pedidos"));
      mocked.joinTrip.mockRejectedValue(needsUpdate());
      await renderRouter(routes, { initialUrl: "/join" });

      await enterCode();

      expect(await screen.findByText("Actualizá Rollo para unirte a este evento.")).toBeVisible();
      expect(mocked.previewEvent).toHaveBeenCalledTimes(2);
    });
  });

  it("Cancelar on a cold-start link (nothing to go back to) goes home", async () => {
    mocked.previewEvent.mockResolvedValue(null);
    await renderRouter(routes, { initialUrl: "/join?code=ABC123" });
    await screen.findByLabelText("Código del rollo");

    await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen).not.toHavePathname("/join"));
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
