const MIN = 3;
const MAX = 30;
const PAD = "rollo";

export const USERNAME_INVALID = "El nombre de usuario puede tener letras, números, punto y guion bajo (3 a 30).";

/** Same normalization as the server: no leading @, trimmed, lowercase. */
export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "").trim().toLowerCase();
}

/** Instant feedback with the server's rules (the server stays the authority). */
export function usernameError(value: string): string | null {
  const v = normalizeUsername(value);
  const valid =
    v.length >= MIN && v.length <= MAX && /^[a-z0-9._]+$/.test(v) && !v.startsWith(".") && !v.endsWith(".") && !v.includes("..");
  return valid ? null : USERNAME_INVALID;
}

/** A valid username derived from the email's local part. */
export function suggestUsername(email: string): string {
  const local = email.split("@")[0] ?? "";
  let v = local
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, MAX)
    .replace(/\.+$/, "");
  if (v.length < MIN) v = `${v}${PAD}`.slice(0, MAX);
  return v;
}

export const formatHandle = (username: string): string => `@${username}`;
