import * as AppleAuthentication from "expo-apple-authentication";
import { APPLE_FAILED, appleSignInEnabled, getAppleAccount } from "../apple";

const signInAsync = jest.mocked(AppleAuthentication.signInAsync);
const credential = (identityToken: string | null, fullName: { givenName: string | null; familyName: string | null } | null) =>
  ({ user: "a1", identityToken, fullName, email: null, realUserStatus: 1, state: null, authorizationCode: null }) as AppleAuthentication.AppleAuthenticationCredential;

describe("getAppleAccount", () => {
  it("returns the identity token and the full name Apple gives on the first sign-in, asking for name and email", async () => {
    signInAsync.mockResolvedValueOnce(credential("atok", { givenName: "Lucía", familyName: "Pérez" }));

    expect(await getAppleAccount()).toEqual({ identityToken: "atok", name: "Lucía Pérez" });
    expect(signInAsync).toHaveBeenLastCalledWith({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
  });

  it("has no name on later sign-ins (Apple only gives it once)", async () => {
    signInAsync.mockResolvedValueOnce(credential("atok", { givenName: null, familyName: null }));
    expect(await getAppleAccount()).toEqual({ identityToken: "atok", name: null });
  });

  it("returns null when the user cancels", async () => {
    expect(await getAppleAccount()).toBeNull();
  });

  it("any other failure, or no identity token, is one Spanish error", async () => {
    signInAsync.mockRejectedValueOnce(Object.assign(new Error("boom"), { code: "ERR_REQUEST_FAILED" }));
    await expect(getAppleAccount()).rejects.toThrow(APPLE_FAILED);
    signInAsync.mockResolvedValueOnce(credential(null, null));
    await expect(getAppleAccount()).rejects.toThrow(APPLE_FAILED);
  });
});

describe("appleSignInEnabled", () => {
  it("only the build that carries the Sign in with Apple entitlement shows the button", () => {
    expect(appleSignInEnabled({ ios: { usesAppleSignIn: true } })).toBe(true);
    expect(appleSignInEnabled({ ios: {} })).toBe(false);
    expect(appleSignInEnabled(null)).toBe(false);
  });
});
