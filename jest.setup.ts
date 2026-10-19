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
  const React = require("react");
  const { Pressable, View } = require("react-native");
  return {
    // El mapa deja tocar "el vacío"; la fuente de pins, un botón por pin (así las pantallas se prueban sin nativo).
    Map: ({ children, onPress }: any) =>
      React.createElement(
        View,
        null,
        React.createElement(Pressable, { accessibilityLabel: "mapa", onPress: () => onPress?.({ nativeEvent: {} }) }),
        children,
      ),
    Camera: View,
    ViewAnnotation: View,
    GeoJSONSource: ({ data, onPress }: any) =>
      React.createElement(
        View,
        null,
        data.features.map((f: any) =>
          React.createElement(Pressable, {
            key: f.properties.id,
            accessibilityLabel: `pin ${f.properties.id}`,
            onPress: () => onPress({ nativeEvent: { features: [f] }, stopPropagation: () => {} }),
          }),
        ),
      ),
    Layer: View,
    UserLocation: View,
    LogManager: { onLog: jest.fn(), setLogLevel: jest.fn() },
    OfflineManager: {
      createPack: jest.fn(),
      getPacks: jest.fn(async () => []),
      setTileCountLimit: jest.fn(),
      deletePack: jest.fn(),
    },
  };
});

// El estilo del mapa se escribe a Documents (expo-file-system, nativo): en los tests es una ruta fija.
jest.mock("@/features/map/style-file", () => ({
  writeStyleFile: jest.fn((scheme: string) => `file:///docs/map/style-${scheme}.json`),
}));

// Controles nativos de @expo/ui: en los tests, botones simples que disparan el mismo callback.
jest.mock("@expo/ui/community/segmented-control", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return {
    SegmentedControl: ({ values, onValueChange }: { values: string[]; onValueChange: (v: string) => void }) =>
      React.createElement(
        View,
        null,
        values.map((v) =>
          React.createElement(
            Pressable,
            { key: v, accessibilityRole: "button", accessibilityLabel: v, onPress: () => onValueChange(v) },
            React.createElement(Text, null, v),
          ),
        ),
      ),
  };
});
jest.mock("@expo/ui/community/menu", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return {
    MenuView: ({ actions, onPressAction, children }: any) =>
      React.createElement(
        View,
        null,
        children,
        actions.map((a: { id: string; title: string }) =>
          React.createElement(
            Pressable,
            {
              key: a.id,
              accessibilityRole: "menuitem",
              accessibilityLabel: a.title,
              onPress: () => onPressAction({ nativeEvent: { event: a.id } }),
            },
            React.createElement(Text, null, a.title),
          ),
        ),
      ),
  };
});

// Ubicación: nativa; en los tests, sin permiso y sin posición (los tests que la necesitan la pisan).
jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: false })),
  getLastKnownPositionAsync: jest.fn(async () => null),
  getCurrentPositionAsync: jest.fn(async () => null),
  Accuracy: { Balanced: 3, High: 5 },
}));
