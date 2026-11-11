import * as AppleAuthentication from "expo-apple-authentication";

export const APPLE_FAILED = "No se pudo entrar con Apple. Probá de nuevo.";

/**
 * Only the build that carries the Sign in with Apple entitlement (production, `ios.usesAppleSignIn` in app.config.ts) can use it:
 * the development build is signed by the free Personal Team, which can't sign that capability.
 */
export function appleSignInEnabled(config: { ios?: { usesAppleSignIn?: boolean } } | null | undefined): boolean {
  return config?.ios?.usesAppleSignIn === true;
}

/**
 * Opens Apple's sign-in sheet. The identity token and the full name (Apple gives it only on the first sign-in), or null if the
 * user canceled.
 */
export async function getAppleAccount(): Promise<{ identityToken: string; name: string | null } | null> {
  let credential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
  } catch (e) {
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return null;
    console.warn("[apple] sign-in failed", e);
    throw new Error(APPLE_FAILED);
  }
  if (!credential.identityToken) throw new Error(APPLE_FAILED);
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ").trim();
  return { identityToken: credential.identityToken, name: name || null };
}
