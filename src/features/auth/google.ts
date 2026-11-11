import { GoogleSignin, isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin";
import Constants from "expo-constants";
import { GOOGLE_WEB_CLIENT_ID, googleIosClientId } from "@/config";

/** Side of the Google profile photo we ask for: the avatar size. */
export const GOOGLE_PHOTO_SIZE = 512;

export const GOOGLE_FAILED = "No se pudo entrar con Google. Probá de nuevo.";

let configured = false;
function configure() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: googleIosClientId(Constants.expoConfig?.ios?.bundleIdentifier),
    // The profile photo URL comes at the avatar's size (512 px square, see AVATAR_MAX).
    profileImageSize: GOOGLE_PHOTO_SIZE,
  });
  configured = true;
}

/**
 * Opens Google's account picker. The chosen account's ID token and photo URL (null when the account has no photo of its own:
 * the SDK leaves out Google's letter avatar), or null if the user closed the picker.
 */
export async function getGoogleAccount(): Promise<{ idToken: string; photo: string | null } | null> {
  configure();
  let response;
  try {
    response = await GoogleSignin.signIn();
  } catch (e) {
    // A second tap while the picker is open is not an error either.
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) return null;
    console.warn("[google] sign-in failed", e);
    throw new Error(GOOGLE_FAILED);
  }
  if (response.type === "cancelled") return null;
  if (!response.data.idToken) throw new Error(GOOGLE_FAILED);
  return { idToken: response.data.idToken, photo: response.data.user.photo };
}

/** Forgets the Google account on this phone (on logout), so the next sign-in shows the picker again. Never throws. */
export async function forgetGoogleAccount(): Promise<void> {
  try {
    configure();
    await GoogleSignin.signOut();
  } catch {
    // Nothing to forget, or the native module is missing: the Rollo session is what matters.
  }
}
