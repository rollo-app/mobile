import * as SecureStore from "expo-secure-store";
import { hasSeenRollStarted, markRollStartedSeen } from "../roll-started";

describe("roll started seen", () => {
  it("is not seen until marked", async () => {
    expect(await hasSeenRollStarted("trip-1")).toBe(false);
  });

  it("is remembered per roll under its persisted key", async () => {
    await markRollStartedSeen("trip-1");
    expect(await hasSeenRollStarted("trip-1")).toBe(true);
    expect(await hasSeenRollStarted("trip-2")).toBe(false);
    expect(await SecureStore.getItemAsync("rollo.rollStartedSeen.trip-1")).toBe("1");
  });
});
