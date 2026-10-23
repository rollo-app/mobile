/**
 * Each magic-link token is checked once per launch: opening the same link twice (a double tap, the
 * deep link arriving again, a remount) shares the first answer instead of burning another attempt.
 */
const attempts = new Map<string, Promise<unknown>>();

export function verifyMagicLinkOnce<T>(email: string, token: string, verify: (email: string, token: string) => Promise<T>): Promise<T> {
  let attempt = attempts.get(token) as Promise<T> | undefined;
  if (!attempt) {
    attempt = verify(email, token);
    attempts.set(token, attempt);
  }
  return attempt;
}

/** For tests: forget the links already checked, as a fresh launch would. */
export const forgetMagicLinks = () => attempts.clear();

export const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
