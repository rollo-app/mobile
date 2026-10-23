import { clearLoginLinkVerifier, getLoginLinkVerifier, setLoginLinkVerifier } from "../login-link-verifier";

describe("login link verifier", () => {
  it("is null until one is saved", async () => {
    expect(await getLoginLinkVerifier()).toBeNull();
  });

  it("saves, overwrites, reads and clears it", async () => {
    await setLoginLinkVerifier({ email: "a@b.c", verifier: "v1" });
    await setLoginLinkVerifier({ email: "a@b.c", verifier: "v2" });
    expect(await getLoginLinkVerifier()).toEqual({ email: "a@b.c", verifier: "v2" });

    await clearLoginLinkVerifier();
    expect(await getLoginLinkVerifier()).toBeNull();
  });

  it("uses the rollo.loginLinkVerifier key", async () => {
    await setLoginLinkVerifier({ email: "a@b.c", verifier: "v1" });
    expect(require("expo-secure-store").__store.has("rollo.loginLinkVerifier")).toBe(true);
  });

  it("ignores a corrupt value", async () => {
    require("expo-secure-store").__store.set("rollo.loginLinkVerifier", "{nope");
    expect(await getLoginLinkVerifier()).toBeNull();
  });
});
