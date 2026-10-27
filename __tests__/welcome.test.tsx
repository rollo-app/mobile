import { fireEvent, renderRouter, screen } from "expo-router/testing-library";
import "@/test/reanimated";
import { AccessibilityInfo } from "react-native";
import { queryClient } from "@/api/query-client";
import * as actions from "@/features/trips/actions";
import { signInAs } from "@/test/account";
import { routes } from "@/test/routes";
import { hasSeenWelcomeIntro, markWelcomeIntroSeen } from "@/storage/welcome-intro";

jest.mock("@/features/trips/actions");
const mocked = jest.mocked(actions);

beforeEach(() => {
  mocked.fetchMyTrips.mockResolvedValue({ trips: [] });
});

describe("A user without rollos", () => {
  beforeEach(() => signInAs({ trips: [] }));

  it("lands on the Rollo tab with a welcome that says who they are", async () => {
    await renderRouter(routes, { initialUrl: "/" });

    expect(await screen.findByText("Todavía no tenés rollos")).toBeVisible();
    expect(screen).toHavePathname("/roll");
    expect(screen.getByText("Empezá uno con tus amigos o sumate con un código.")).toBeVisible();
    expect(screen.getAllByText("Juani").length).toBeGreaterThan(0);
    expect(screen.getAllByText("@juani").length).toBeGreaterThan(0);
  });

  describe("logo mark", () => {
    beforeEach(() => {
      jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    });
    afterEach(() => {
      jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
    });

    it("plays once the first time the welcome shows", async () => {
      await renderRouter(routes, { initialUrl: "/roll" });

      const mark = await screen.findByTestId("lottie", { includeHiddenElements: true });
      expect(mark.props.autoPlay).toBe(true);
      expect(mark.props.loop).toBe(false);
      expect(await hasSeenWelcomeIntro()).toBe(true);
    });

    it("is the still last frame on later visits", async () => {
      await markWelcomeIntroSeen();
      await renderRouter(routes, { initialUrl: "/roll" });

      const mark = await screen.findByTestId("lottie", { includeHiddenElements: true });
      expect(mark.props.autoPlay).toBe(false);
      expect(mark.props.progress).toBe(1);
    });

    it("is still from the start with Reduce Motion on, and counts as seen", async () => {
      jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
      await renderRouter(routes, { initialUrl: "/roll" });

      const mark = await screen.findByTestId("lottie", { includeHiddenElements: true });
      expect(mark.props.autoPlay).toBe(false);
      expect(mark.props.progress).toBe(1);
      expect(await hasSeenWelcomeIntro()).toBe(true);
    });
  });

  it("starts a new roll from the welcome", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });

    await fireEvent.press(await screen.findByRole("button", { name: "Empezar un nuevo rollo" }));

    expect(screen).toHavePathname("/create");
  });

  it("joins with a code from the welcome", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });

    await fireEvent.press(await screen.findByRole("button", { name: "Sumarme con un código" }));

    expect(screen).toHavePathname("/join");
  });

  it("shows the error and still offers both actions when the rollos can't be loaded", async () => {
    mocked.fetchMyTrips.mockRejectedValue(new Error("Sin conexión"));
    queryClient.removeQueries({ queryKey: ["myTrips"] });
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByText("Sin conexión")).toBeVisible();
    expect(screen.getByRole("button", { name: "Empezar un nuevo rollo" })).toBeVisible();
  });

  it("Mapa points to the Rollo tab instead of showing an empty map", async () => {
    await renderRouter(routes, { initialUrl: "/map" });

    expect(await screen.findByText("Primero hace falta un rollo")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Ir a Rollo" }));
    expect(screen).toHavePathname("/roll");
  });

  it("the Feed view points to the Rollo tab instead of an empty list", async () => {
    await renderRouter(routes, { initialUrl: "/map?view=feed" });

    expect(await screen.findByText("Primero hace falta un rollo")).toBeVisible();
  });

  it("Perfil's Ajustes still edits the profile and signs out, with no rollo sections", async () => {
    await renderRouter(routes, { initialUrl: "/me" });
    await fireEvent.press(await screen.findByRole("button", { name: "Ajustes" }));

    expect(await screen.findByRole("button", { name: "Editar perfil" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Borrar cuenta" })).toBeVisible();
    expect(screen.queryByText("Rollo activo")).toBeNull();
    expect(screen.queryByText("Invitar")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Tus rollos/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Mapa sin señal/ })).toBeVisible();
  });
});
