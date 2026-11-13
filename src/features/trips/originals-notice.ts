import type { Trip } from "./actions";
import { formatDate } from "./phase";

/**
 * The note about the full-quality originals of a revealed roll, or null when there is nothing to say
 * (the roll keeps them, or the server sent no expiry). The date is the roll's local day.
 */
export function originalsNotice(originals: Trip["originals"] | undefined, timeZone: string): string | null {
  if (!originals || originals.keep) return null;
  if (originals.purged) return "Las fotos en máxima calidad ya se borraron. Quedan en alta calidad para ver y guardar.";
  if (originals.expiresAt === null) return null;
  return `Las fotos en máxima calidad se borran el ${formatDate(originals.expiresAt, timeZone)}. Guardalas en tu celular antes.`;
}
