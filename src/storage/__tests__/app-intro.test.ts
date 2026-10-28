import * as SecureStore from "expo-secure-store";
import { markAppIntroPending, takeAppIntroPending } from "../app-intro";

describe("app intro flag", () => {
  it("is not pending until marked", async () => {
    expect(await takeAppIntroPending()).toBe(false);
  });

  it("is taken once and remembered under its persisted keys", async () => {
    await markAppIntroPending();
    expect(await SecureStore.getItemAsync("rollo.appIntroPending")).toBe("1");
    expect(await takeAppIntroPending()).toBe(true);
    expect(await SecureStore.getItemAsync("rollo.appIntroPending")).toBeNull();
    expect(await SecureStore.getItemAsync("rollo.appIntroSeen")).toBe("1");
    expect(await takeAppIntroPending()).toBe(false);
  });

  it("is not queued again once this phone showed it", async () => {
    await markAppIntroPending();
    await takeAppIntroPending();
    await markAppIntroPending();
    expect(await takeAppIntroPending()).toBe(false);
  });

  it("a stale pending flag on a phone that already showed it is dropped", async () => {
    await SecureStore.setItemAsync("rollo.appIntroSeen", "1");
    await SecureStore.setItemAsync("rollo.appIntroPending", "1");
    expect(await takeAppIntroPending()).toBe(false);
    expect(await SecureStore.getItemAsync("rollo.appIntroPending")).toBeNull();
  });
});
