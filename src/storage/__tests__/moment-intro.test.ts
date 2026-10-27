import * as SecureStore from "expo-secure-store";
import { forgetMomentIntro, hasSeenMomentIntro, markMomentIntroSeen } from "../moment-intro";

describe("moment intro seen", () => {
  it("is not seen until marked", async () => {
    expect(await hasSeenMomentIntro("trip-1", "2027-01-05")).toBe(false);
  });

  it("is remembered per roll and day under its persisted key", async () => {
    await markMomentIntroSeen("trip-1", "2027-01-05");
    expect(await hasSeenMomentIntro("trip-1", "2027-01-05")).toBe(true);
    expect(await hasSeenMomentIntro("trip-1", "2027-01-06")).toBe(false);
    expect(await hasSeenMomentIntro("trip-2", "2027-01-05")).toBe(false);
    expect(await SecureStore.getItemAsync("rollo.momentIntroSeen.trip-1.2027-01-05")).toBe("1");
  });

  it("can be forgotten for one roll and day (dev: replay the intro)", async () => {
    await markMomentIntroSeen("trip-1", "2027-01-05");
    await markMomentIntroSeen("trip-1", "2027-01-06");
    await forgetMomentIntro("trip-1", "2027-01-05");
    expect(await hasSeenMomentIntro("trip-1", "2027-01-05")).toBe(false);
    expect(await hasSeenMomentIntro("trip-1", "2027-01-06")).toBe(true);
  });
});
