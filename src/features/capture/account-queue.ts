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
