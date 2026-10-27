import { Directory, Paths } from "expo-file-system";
import { getQueue } from "./store";

/** Deletes an account's pending photos: its rows and their Documents/pending/<id> folders. Other accounts' are untouched. */
export async function discardAccountQueue(userId: string): Promise<void> {
  const ids = await (await getQueue()).removeAllForOwner(userId);
  for (const id of ids) {
    try {
      const dir = new Directory(Paths.document, "pending", id);
      if (dir.exists) dir.delete();
    } catch {
      // Best effort: the row is gone, an orphan folder is harmless.
    }
  }
}

/**
 * Gives the photos queued without an owner (before the app tracked accounts, or by a session that hadn't learned its id
 * yet) to that same session, the moment it learns its id. Only that path calls it: an account that signs in later never
 * claims them, so a photo never goes up with someone else's account.
 */
export async function claimLegacyQueue(userId: string): Promise<void> {
  await (await getQueue()).claimUnowned(userId);
}
