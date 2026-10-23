import { ApiError } from "@/api/client";

/**
 * A magic link is checked once at a time: opening it twice while it's being checked (a double tap, the
 * deep link arriving again, a remount) shares that answer. A link the server rejected stays rejected
 * without burning another attempt; an offline failure can be retried, and a link that already signed in
 * is asked again (after a logout it has to fail on its own instead of looking signed in).
 */
const attempts = new Map<string, Promise<unknown>>();

export function verifyMagicLinkOnce<T>(email: string, token: string, verify: (email: string, token: string) => Promise<T>): Promise<T> {
  const key = `${email.trim().toLowerCase()}\n${token}`;
  const existing = attempts.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const attempt = verify(email, token).then(
    (result) => {
      attempts.delete(key);
      return result;
    },
    (error: unknown) => {
      // Only the server's verdict on the link (4xx) is final; offline (0) or a 5xx can be retried.
      const rejected = error instanceof ApiError && error.status >= 400 && error.status < 500;
      if (!rejected) attempts.delete(key);
      throw error;
    },
  );
  attempts.set(key, attempt);
  return attempt;
}

/** For tests: forget the links already checked, as a fresh launch would. */
export const forgetMagicLinks = () => attempts.clear();

export const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
