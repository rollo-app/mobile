import * as SecureStore from "expo-secure-store";
import { hasSeenPushPrimer, markPushPrimerSeen } from "../push-primer";

describe("push primer flag", () => {
  it("starts unseen and stays seen once marked, under its persisted key", async () => {
    expect(await hasSeenPushPrimer()).toBe(false);
    await markPushPrimerSeen();
    expect(await hasSeenPushPrimer()).toBe(true);
    expect(await SecureStore.getItemAsync("rollo.pushPrimerSeen")).toBe("1");
  });
});
