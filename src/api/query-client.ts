import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import Storage from "expo-sqlite/kv-store";
import { AppState } from "react-native";

const SECOND = 1000;
const DAY = 24 * 60 * 60 * SECOND;

/** Cuánto se guarda el cache en el celular (también es el `maxAge` del persister). */
export const CACHE_MAX_AGE = 7 * DAY;

/**
 * Cliente de datos de la app. `offlineFirst`: siempre se intenta pedir, pero si no hay
 * señal se muestra lo que hay en cache. Los datos son "frescos" 30 s: dentro de ese
 * rato nadie vuelve a pedir el mismo viaje.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: "offlineFirst",
        staleTime: 30 * SECOND,
        gcTime: CACHE_MAX_AGE,
        retry: 1,
      },
    },
  });
}

export const queryClient = createQueryClient();

export const persister = createAsyncStoragePersister({ storage: Storage, key: "rollo.query-cache" });

/**
 * El foco de la app es AppState. Sin NetInfo no sabemos si hay señal: damos por
 * "online" a la app mientras está en primer plano, así al volver se reintenta lo pausado.
 */
export function connectAppState() {
  const subscription = AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));
  onlineManager.setEventListener((setOnline) => {
    const sub = AppState.addEventListener("change", (state) => setOnline(state === "active"));
    return () => sub.remove();
  });
  return () => subscription.remove();
}
