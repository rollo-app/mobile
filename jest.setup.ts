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
