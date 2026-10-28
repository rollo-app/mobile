import * as SecureStore from "expo-secure-store";
import { hasSeenWelcomeIntro, markWelcomeIntroSeen } from "../welcome-intro";

describe("welcome intro seen", () => {
  it("is not seen until marked", async () => {
    expect(await hasSeenWelcomeIntro()).toBe(false);
  });

  it("is remembered under its persisted key", async () => {
    await markWelcomeIntroSeen();
    expect(await hasSeenWelcomeIntro()).toBe(true);
    expect(await SecureStore.getItemAsync("rollo.welcomeIntroSeen")).toBe("1");
  });
});
