import { API_URL } from "@/config";
import { getToken } from "@/storage/trips";
import { getQueue } from "./store";
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
        // Import perezoso: expo-file-system es nativo y los tests no lo cargan.
        const { File } = await import("expo-file-system");
        const result = await new File(uri).upload(url, {
          httpMethod: "PUT",
          headers: { "Content-Type": contentType },
        });
        return result.status;
      },
      fileExists: async (uri) => {
        const { File } = await import("expo-file-system");
        return new File(uri).exists;
      },
      removeFiles: async (id) => {
        const { Directory, Paths } = await import("expo-file-system");
        const dir = new Directory(Paths.document, "pending", id);
        if (dir.exists) dir.delete();
      },
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
