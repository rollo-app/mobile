import { Directory, File, Paths } from "expo-file-system";
import { queryClient } from "@/api/query-client";
import { API_URL } from "@/config";
import { getSession, getSessionUserId } from "@/features/auth/session";
import { getQueue } from "./store";
import { pendingItemsKey } from "./use-pending-items";
import { pendingKey } from "./use-pending-count";
import { createUploader, type RunOptions } from "./uploader";

let uploader: Promise<ReturnType<typeof createUploader>> | null = null;

/** The app's uploader: a single one, with the real queue and the Documents files. */
function getUploader() {
  uploader ??= getQueue().then((queue) =>
    createUploader({
      queue,
      apiUrl: API_URL,
      getToken: getSession,
      getUserId: getSessionUserId,
      putFile: async (uri, url, contentType) => {
        const result = await new File(uri).upload(url, {
          httpMethod: "PUT",
          headers: { "Content-Type": contentType },
        });
        return result.status;
      },
      fileSize: async (uri) => {
        const file = new File(uri);
        return file.exists ? (file.size ?? null) : null;
      },
      removeFiles: async (id) => {
        const dir = new Directory(Paths.document, "pending", id);
        if (dir.exists) dir.delete();
      },
      // After removing it from the queue: otherwise for a moment it counts on both the server and the queue.
      onUploaded: async (tripId) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["trip", tripId] }),
          queryClient.invalidateQueries({ queryKey: ["feed", tripId] }),
          queryClient.invalidateQueries({ queryKey: pendingKey(tripId) }),
          queryClient.invalidateQueries({ queryKey: pendingItemsKey(tripId) }),
        ]);
      },
      onDiscarded: async (tripId) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: pendingKey(tripId) }),
          queryClient.invalidateQueries({ queryKey: pendingItemsKey(tripId) }),
        ]);
      },
    }),
  );
  return uploader;
}

/**
 * One upload pass; rejects if the queue or the uploader fail. With `deadline` (epoch ms) it stops
 * between items once the time is up (background tasks have a limited budget).
 */
export async function runUploadPass(options?: RunOptions): Promise<void> {
  await (await getUploader()).run(options);
}

/**
 * Requests an upload pass. Never throws: if something fails it stays in the queue for the
 * next trigger (opening the app, returning to foreground, sending another photo).
 */
export async function syncQueue(options?: RunOptions): Promise<void> {
  try {
    await runUploadPass(options);
  } catch (e) {
    console.warn("No se pudo subir la cola", e);
  }
}
