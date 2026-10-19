import { Directory, File, Paths } from "expo-file-system";
import { queryClient } from "@/api/query-client";
import { API_URL } from "@/config";
import { getToken } from "@/storage/trips";
import { getQueue } from "./store";
import { pendingKey } from "./use-pending-count";
import { createUploader } from "./uploader";

let uploader: Promise<ReturnType<typeof createUploader>> | null = null;

/** El uploader de la app: uno solo, con la cola real y los archivos de Documents. */
function getUploader() {
  uploader ??= getQueue().then((queue) =>
    createUploader({
      queue,
      apiUrl: API_URL,
      getToken,
      putFile: async (uri, url, contentType) => {
        const result = await new File(uri).upload(url, {
          httpMethod: "PUT",
          headers: { "Content-Type": contentType },
        });
        return result.status;
      },
      fileExists: async (uri) => {
        return new File(uri).exists;
      },
      removeFiles: async (id) => {
        const dir = new Directory(Paths.document, "pending", id);
        if (dir.exists) dir.delete();
      },
      // Después de sacarla de la cola: si no, por un instante cuenta en el server y en la cola.
      onUploaded: async (tripId) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["trip", tripId] }),
          queryClient.invalidateQueries({ queryKey: pendingKey(tripId) }),
        ]);
      },
      onDiscarded: (tripId) => queryClient.invalidateQueries({ queryKey: pendingKey(tripId) }),
    }),
  );
  return uploader;
}

/**
 * Pide una pasada de subida. Nunca tira: si falla algo queda en la cola para el
 * próximo disparador (abrir la app, volver a primer plano, mandar otra foto).
 */
export async function syncQueue(): Promise<void> {
  try {
    await (await getUploader()).run();
  } catch (e) {
    console.warn("No se pudo subir la cola", e);
  }
}
