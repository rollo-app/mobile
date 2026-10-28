import { clearSessionUserId, getSessionUserIdStored, setSessionUserId } from "../session-user";

describe("session user id", () => {
  it("is null until one is saved, then saves and clears it", async () => {
    expect(await getSessionUserIdStored()).toBeNull();
    await setSessionUserId("u1");
    expect(await getSessionUserIdStored()).toBe("u1");

    await clearSessionUserId();
    expect(await getSessionUserIdStored()).toBeNull();
  });

  it("uses the rollo.sessionUserId key", async () => {
    await setSessionUserId("u1");
    expect(require("expo-secure-store").__store.get("rollo.sessionUserId")).toBe("u1");
  });
});
