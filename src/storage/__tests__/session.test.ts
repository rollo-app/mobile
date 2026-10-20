import { clearActiveTripId, getActiveTripId, setActiveTripId } from "../active-trip";
import { clearSessionToken, getSessionToken, setSessionToken } from "../session";

describe("session token", () => {
  it("is null until one is saved", async () => {
    expect(await getSessionToken()).toBeNull();
  });

  it("saves and clears the token", async () => {
    await setSessionToken("abc");
    expect(await getSessionToken()).toBe("abc");

    await clearSessionToken();
    expect(await getSessionToken()).toBeNull();
  });

  it("uses the rollo.session key", async () => {
    await setSessionToken("abc");
    expect(require("expo-secure-store").__store.get("rollo.session")).toBe("abc");
  });
});

describe("active trip id", () => {
  it("saves, reads and clears the id", async () => {
    expect(await getActiveTripId()).toBeNull();
    await setActiveTripId("t1");
    expect(await getActiveTripId()).toBe("t1");
    expect(require("expo-secure-store").__store.get("rollo.activeTrip")).toBe("t1");

    await clearActiveTripId();
    expect(await getActiveTripId()).toBeNull();
  });
});
