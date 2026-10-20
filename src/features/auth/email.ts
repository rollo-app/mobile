/** Enough to enable the button; the server has the last word. */
export function isValidEmail(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email.trim());
}
