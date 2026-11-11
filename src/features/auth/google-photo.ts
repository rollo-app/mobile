/**
 * The Google photo of an account that just signed up with Google, for "Completá tu perfil" to use as the default photo.
 * Only in memory: if the app closes before that step, the account simply starts without a photo.
 */
let pending: string | null = null;

export function setPendingGooglePhoto(url: string | null): void {
  pending = url;
}

/** Hands the photo over once: whoever takes it is the only one who uses it. */
export function takePendingGooglePhoto(): string | null {
  const url = pending;
  pending = null;
  return url;
}
