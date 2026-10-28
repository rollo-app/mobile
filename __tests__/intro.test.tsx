import { AccessibilityInfo } from "react-native";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import "@/test/reanimated";
import * as actions from "@/features/trips/actions";
import { markAppIntroPending } from "@/storage/app-intro";
import { hasSeenWelcomeIntro } from "@/storage/welcome-intro";
import { signInAs } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");

// The welcome behind the intro has its own logo: pick the intro's by its source.
const introMark = () => {
  const source = require("../assets/lottie/app-intro-light.json");
  return screen.getAllByTestId("lottie", { includeHiddenElements: true }).find((node) => node.props.source === source)!;
};

const reduceMotion = jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled");

beforeEach(async () => {
  reduceMotion.mockResolvedValue(false);
  jest.mocked(actions).fetchMyTrips.mockResolvedValue({ trips: [] });
  await signInAs();
});
afterAll(() => reduceMotion.mockResolvedValue(false));

describe("App intro", () => {
  it("opens on top of the app after a new account's profile, the button shows up later and leads into the app", async () => {
    await markAppIntroPending();
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByText("Sacá la foto.")).toBeVisible();
    expect(screen.getByText("Mirala después.")).toBeVisible();
    expect(screen).toHavePathname("/intro");
    expect(introMark()).toBeTruthy();
    expect(introMark().props.autoPlay).toBe(true);
    // Not there yet: neither pressable nor readable.
    expect(screen.queryByRole("button", { name: "Empezar" })).toBeNull();

    await fireEvent.press(await screen.findByRole("button", { name: "Empezar" }, { timeout: 4000 }));
    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(screen.queryByText("Sacá la foto.")).toBeNull();
  });

  it("marks the welcome's logo as seen so it doesn't animate again", async () => {
    await markAppIntroPending();
    await renderRouter(routes, { initialUrl: "/roll" });
    await screen.findByText("Sacá la foto.");
    await waitFor(async () => expect(await hasSeenWelcomeIntro()).toBe(true));
  });

  it("doesn't open for a user that never queued it", async () => {
    await renderRouter(routes, { initialUrl: "/roll" });
    expect(await screen.findByText("Todavía no tenés rollos")).toBeVisible();
    expect(screen).toHavePathname("/roll");
  });

  it("with Reduce Motion the logo is still and the button comes sooner", async () => {
    reduceMotion.mockResolvedValue(true);
    await markAppIntroPending();
    await renderRouter(routes, { initialUrl: "/roll" });

    await screen.findByText("Sacá la foto.");
    const lottie = introMark();
    expect(lottie.props.autoPlay).toBe(false);
    expect(lottie.props.progress).toBe(1);
    expect(await screen.findByRole("button", { name: "Empezar" }, { timeout: 2000 })).toBeVisible();
  });
});
