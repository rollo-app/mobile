import * as SecureStore from "expo-secure-store";
import { hasSeenPresentation } from "../presentation";
import { hasSeenRevealIntro, markRevealIntroSeen } from "../reveal-intro";

describe("reveal intro seen", () => {
  it("is not seen until marked", async () => {
    expect(await hasSeenRevealIntro("trip-1")).toBe(false);
  });

  it("is remembered per roll under its own key", async () => {
    await markRevealIntroSeen("trip-1");
    expect(await hasSeenRevealIntro("trip-1")).toBe(true);
    expect(await hasSeenRevealIntro("trip-2")).toBe(false);
    expect(await SecureStore.getItemAsync("rollo.revealIntroSeen.trip-1")).toBe("1");
  });

  it("is independent from the presentation's automatic opening", async () => {
    await markRevealIntroSeen("trip-1");
    expect(await hasSeenPresentation("trip-1")).toBe(false);
  });
});
