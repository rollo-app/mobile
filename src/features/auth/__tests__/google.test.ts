import { GoogleSignin, type SignInResponse } from "@react-native-google-signin/google-signin";
import { GOOGLE_IOS_CLIENT_IDS, GOOGLE_WEB_CLIENT_ID, googleIosClientId } from "@/config";
import { forgetGoogleAccount, getGoogleAccount, GOOGLE_FAILED } from "../google";

const signIn = jest.mocked(GoogleSignin.signIn);
const success = (idToken: string | null, photo: string | null = null): SignInResponse => ({
  type: "success",
  data: { idToken, serverAuthCode: null, scopes: [], user: { id: "g1", name: "Juani", email: "juani@gmail.com", photo, familyName: null, givenName: null } },
});

describe("getGoogleAccount", () => {
  it("returns the ID token of the chosen account, asking it for our web client and a 512 px photo", async () => {
    signIn.mockResolvedValueOnce(success("gtok", "https://lh3.googleusercontent.com/a/xyz=s512"));

    expect(await getGoogleAccount()).toEqual({ idToken: "gtok", photo: "https://lh3.googleusercontent.com/a/xyz=s512" });
    expect(GoogleSignin.configure).toHaveBeenCalledWith(expect.objectContaining({ webClientId: GOOGLE_WEB_CLIENT_ID, profileImageSize: 512 }));
  });

  it("has no photo when the Google account has none (Google's letter avatar)", async () => {
    signIn.mockResolvedValueOnce(success("gtok", null));
    expect(await getGoogleAccount()).toEqual({ idToken: "gtok", photo: null });
  });

  it("returns null when the user closes the picker", async () => {
    signIn.mockResolvedValueOnce({ type: "cancelled", data: null });
    expect(await getGoogleAccount()).toBeNull();
  });

  it("returns null for a cancel or a sign-in already in progress reported as errors", async () => {
    signIn.mockRejectedValueOnce(Object.assign(new Error("cancel"), { code: "SIGN_IN_CANCELLED" }));
    expect(await getGoogleAccount()).toBeNull();
    signIn.mockRejectedValueOnce(Object.assign(new Error("busy"), { code: "IN_PROGRESS" }));
    expect(await getGoogleAccount()).toBeNull();
  });

  it("any other failure, or no ID token, is one Spanish error", async () => {
    signIn.mockRejectedValueOnce(Object.assign(new Error("boom"), { code: "-5" }));
    await expect(getGoogleAccount()).rejects.toThrow(GOOGLE_FAILED);
    signIn.mockResolvedValueOnce(success(null));
    await expect(getGoogleAccount()).rejects.toThrow(GOOGLE_FAILED);
  });
});

describe("forgetGoogleAccount", () => {
  it("signs out of Google and never throws", async () => {
    jest.mocked(GoogleSignin.signOut).mockRejectedValueOnce(new Error("nope"));
    await expect(forgetGoogleAccount()).resolves.toBeUndefined();
    expect(GoogleSignin.signOut).toHaveBeenCalled();
  });
});

describe("googleIosClientId", () => {
  it("picks the iOS client of each build", () => {
    expect(googleIosClientId("com.juanifraga.rollo.app")).toBe(GOOGLE_IOS_CLIENT_IDS.production);
    expect(googleIosClientId("com.juanifraga.rollo")).toBe(GOOGLE_IOS_CLIENT_IDS.development);
    expect(googleIosClientId(undefined)).toBe(GOOGLE_IOS_CLIENT_IDS.development);
  });
});
