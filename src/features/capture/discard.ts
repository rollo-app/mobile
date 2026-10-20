import { Directory, Paths } from "expo-file-system";
import { queryClient } from "@/api/query-client";
import { getQueue } from "./store";
import { queueKeys } from "./use-upload-status";

/** Gives up on a failed item: out of the queue and its Documents/pending/<id> files deleted. */
export async function discardFailed(tripId: string, id: string) {
  await (await getQueue()).discard(id);
  const dir = new Directory(Paths.document, "pending", id);
  if (dir.exists) dir.delete();
  await Promise.all(queueKeys(tripId).map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
