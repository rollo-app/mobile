// SecureStore en memoria: los tests no tocan el llavero real.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

beforeEach(() => {
  (require("expo-secure-store").__store as Map<string, string>).clear();
});

// La cola de subida usa expo-sqlite (nativo): en los tests va un SQLite en memoria.
jest.mock("@/features/capture/store", () => {
  const { createQueue } = jest.requireActual("@/features/capture/queue");
  const { memoryDb } = jest.requireActual("@/test/sqlite-memory");
  return { getQueue: jest.fn(() => createQueue(memoryDb())) };
});

// expo-file-system es nativo: un File que existe y sube bien, y carpetas que no hacen nada.
jest.mock("expo-file-system", () => {
  class File {
    constructor(..._parts: unknown[]) {}
    get exists() {
      return true;
    }
    async upload(_url: string, _options?: unknown) {
      return { status: 200, body: "" };
    }
    delete() {}
  }
  class Directory {
    constructor(..._parts: unknown[]) {}
    get exists() {
      return true;
    }
    delete() {}
  }
  return { File, Directory, Paths: { document: "file:///docs/", cache: "file:///cache/" } };
});

// El cache de datos persiste en expo-sqlite/kv-store (nativo): en los tests va en memoria.
jest.mock("expo-sqlite/kv-store", () => {
  const store = new Map<string, string>();
  const kv = {
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
  return { __esModule: true, default: kv, __store: store };
});

// Cada test arranca sin datos en cache y sin reintentos (los errores se ven al toque).
beforeEach(() => {
  const { queryClient } = require("@/api/query-client") as typeof import("@/api/query-client");
  queryClient.clear();
  (require("expo-sqlite/kv-store").__store as Map<string, string>).clear();
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  });
});

// MapLibre es nativo: en los tests el mapa y sus partes son vistas vacías y no hay zonas offline.
jest.mock("@maplibre/maplibre-react-native", () => {
  const { View } = require("react-native");
  return {
    Map: View,
    Camera: View,
    ViewAnnotation: View,
    OfflineManager: {
      createPack: jest.fn(),
      getPacks: jest.fn(async () => []),
      setTileCountLimit: jest.fn(),
      deletePack: jest.fn(),
    },
  };
});
