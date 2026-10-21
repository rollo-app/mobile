// In-memory SecureStore: tests don't touch the real keychain.
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

// The upload queue uses expo-sqlite (native): tests get an in-memory SQLite.
jest.mock("@/features/capture/store", () => {
  const { createQueue } = jest.requireActual("@/features/capture/queue");
  const { memoryDb } = jest.requireActual("@/test/sqlite-memory");
  return { getQueue: jest.fn(() => createQueue(memoryDb())) };
});

// expo-file-system is native: a File that exists and uploads fine, and folders that do nothing.
jest.mock("expo-file-system", () => {
  class File {
    constructor(..._parts: unknown[]) {}
    uri = "file:///cache/tmp";
    get exists() {
      return true;
    }
    async upload(_url: string, _options?: unknown) {
      return { status: 200, body: "" };
    }
    delete() {
      (File as any).deleted += 1;
    }
    static deleted = 0;
    static downloadFileAsync = jest.fn(async (_url: string, destination: unknown, _options?: unknown) => destination);
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

// The data cache persists in expo-sqlite/kv-store (native): in tests it's in memory.
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

// Each test starts with no cached data and no retries (errors show up immediately).
beforeEach(() => {
  const { queryClient } = require("@/api/query-client") as typeof import("@/api/query-client");
  queryClient.clear();
  (require("expo-sqlite/kv-store").__store as Map<string, string>).clear();
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  });
});

beforeEach(() => {
  (require("@/features/auth/session") as typeof import("@/features/auth/session")).resetKnownSession();
});

// Its gc timers (7 days) would keep Jest from exiting.
afterEach(() => {
  (require("@/api/query-client") as typeof import("@/api/query-client")).queryClient.clear();
});

// MapLibre is native: in tests the map and its parts are empty views and there are no offline regions.
jest.mock("@maplibre/maplibre-react-native", () => {
  const React = require("react");
  const { Pressable, View } = require("react-native");
  const camera = { flyTo: jest.fn(), easeTo: jest.fn(), fitBounds: jest.fn() };
  const getClusterLeaves = jest.fn();
  const mapProps: { current: any } = { current: null };
  const imagesProps: { current: any } = { current: null };
  return {
    __camera: camera,
    __getClusterLeaves: getClusterLeaves,
    __mapProps: mapProps,
    __imagesProps: imagesProps,
    // The map lets you tap "the void"; the pin source renders a button per pin (so screens can be tested without native).
    Map: (props: any) => {
      const { children, onPress, onDidFinishLoadingMap } = props;
      mapProps.current = props;
      React.useEffect(() => {
        onDidFinishLoadingMap?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return React.createElement(
        View,
        null,
        React.createElement(Pressable, { accessibilityLabel: "mapa", onPress: () => onPress?.({ nativeEvent: {} }) }),
        children,
      );
    },
    Camera: ({ ref }: any) => {
      React.useImperativeHandle(ref, () => camera);
      return null;
    },
    ViewAnnotation: View,
    // With 2+ photos it adds a "cluster" whose leaves are the first two.
    GeoJSONSource: ({ data, onPress, ref }: any) => {
      React.useImperativeHandle(ref, () => ({
        getClusterLeaves,
      }));
      getClusterLeaves.mockImplementation(async () => data.features.slice(0, 2));
      const cluster = {
        type: "Feature",
        geometry: data.features[0]?.geometry,
        properties: { cluster: true, cluster_id: 1, point_count: 2 },
      };
      return React.createElement(
        View,
        null,
        data.features.length > 1 &&
          React.createElement(Pressable, {
            accessibilityLabel: "cluster",
            onPress: () => onPress({ nativeEvent: { features: [cluster] }, stopPropagation: () => {} }),
          }),
        data.features.map((f: any) =>
          React.createElement(Pressable, {
            key: f.properties.id,
            accessibilityLabel: `pin ${f.properties.id}`,
            onPress: () => onPress({ nativeEvent: { features: [f] }, stopPropagation: () => {} }),
          }),
        ),
      );
    },
    Layer: View,
    Images: (props: any) => {
      imagesProps.current = props;
      return null;
    },
    UserLocation: View,
    LogManager: { onLog: jest.fn(), setLogLevel: jest.fn() },
    OfflineManager: {
      createPack: jest.fn(),
      getPacks: jest.fn(async () => []),
      setTileCountLimit: jest.fn(),
      deletePack: jest.fn(),
      clearAmbientCache: jest.fn(),
      addListener: jest.fn(async () => {}),
      removeListener: jest.fn(),
    },
  };
});

// Pin avatars are downloaded and drawn to a file (expo-file-system, native): in tests it's a fixed path per key.
jest.mock("@/features/map/pin-avatar-files", () => ({
  PIN_AVATAR_POINTS: 30,
  PIN_AVATAR_SCALE: 3,
  ensurePinAvatarFile: jest.fn(async (_uri: string, key: string) => `file:///cache/pin-avatar/${key}.png`),
}));

// Network state is native: in tests the phone has no connection (so nothing tries to download maps).
jest.mock("expo-network", () => ({
  NetworkStateType: { NONE: "NONE", UNKNOWN: "UNKNOWN", WIFI: "WIFI", CELLULAR: "CELLULAR" },
  getNetworkStateAsync: jest.fn(async () => ({ type: "NONE", isConnected: false, isInternetReachable: false })),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// The map style is written to Documents (expo-file-system, native): in tests it's a fixed path.
jest.mock("@/features/map/style-file", () => ({
  writeStyleFile: jest.fn((scheme: string) => `file:///docs/map/style-${scheme}.json`),
}));

// Native @expo/ui controls: in tests, simple buttons that fire the same callback.
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
    MenuView: ({ actions, onPressAction, children, style }: any) =>
      React.createElement(
        View,
        { style },
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

// Native SwiftUI controls (@expo/ui/swift-ui): in tests, plain views that expose the same callbacks.
// Controls are found by accessibilityLabel (DatePicker title, Stepper label) or placeholder (TextField).
jest.mock("@expo/ui/swift-ui", () => {
  const React = require("react");
  const { Pressable, Text: RNText, TextInput, View } = require("react-native");
  const h = React.createElement;
  const Wrap = ({ children }: any) => h(View, null, children);
  return {
    Host: Wrap,
    Form: Wrap,
    Text: ({ children }: any) => h(RNText, null, children),
    Section: ({ title, footer, children }: any) =>
      h(View, null, title && h(RNText, null, title), children, footer),
    TextField: ({ placeholder, onTextChange }: any) =>
      h(TextInput, { placeholder, onChangeText: onTextChange }),
    DatePicker: ({ title, selection, range }: any) =>
      h(View, { accessibilityLabel: title, accessibilityValue: { text: String(selection?.getTime()) }, testID: range?.start ? String(range.start.getTime()) : undefined }),
    Stepper: ({ label, value }: any) =>
      h(View, { accessibilityLabel: label, accessibilityValue: { text: String(value) } }, h(RNText, null, label)),
    Picker: ({ selection, onSelectionChange, children }: any) =>
      h(
        View,
        null,
        React.Children.map(children, (child: any) =>
          h(
            Pressable,
            {
              accessibilityRole: "button",
              accessibilityLabel: child.props.children,
              accessibilityState: { selected: child.props.modifiers?.[0]?.tag === selection },
              onPress: () => onSelectionChange(child.props.modifiers?.[0]?.tag),
            },
            h(RNText, null, child.props.children),
          ),
        ),
      ),
  };
});
jest.mock("@expo/ui/swift-ui/modifiers", () => ({
  tag: (tag: string) => ({ tag }),
  pickerStyle: (style: string) => ({ style }),
  foregroundStyle: (style: unknown) => ({ foregroundStyle: style }),
}));

// Location: native; in tests, no permission and no position (tests that need it override it).
jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: false })),
  getLastKnownPositionAsync: jest.fn(async () => null),
  getCurrentPositionAsync: jest.fn(async () => null),
  Accuracy: { Balanced: 3, High: 5 },
}));

// Background tasks are native: tests get task definitions they can read back and a BackgroundTask that does nothing.
jest.mock("expo-task-manager", () => {
  const tasks = new Map<string, () => Promise<unknown>>();
  return {
    __tasks: tasks,
    defineTask: jest.fn((name: string, executor: () => Promise<unknown>) => {
      tasks.set(name, executor);
    }),
  };
});

jest.mock("expo-background-task", () => ({
  BackgroundTaskStatus: { Restricted: 1, Available: 2 },
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  getStatusAsync: jest.fn(async () => 2),
  registerTaskAsync: jest.fn(async () => {}),
  triggerTaskWorkerForTestingAsync: jest.fn(async () => true),
}));

// Header buttons (Stack.Toolbar) are drawn by UIKit, not React: in tests, plain buttons rendered in place.
{
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  const { Stack } = require("expo-router");
  // Like the real one, only Button/Menu/View/Spacer are accepted as direct children: a Fragment is dropped
  // (so its items never reach the header). Throw instead of silently losing them.
  const Toolbar = ({ children, placement }: any) => {
    React.Children.toArray(children).forEach((c: any) => {
      if (c?.type === React.Fragment) throw new Error(`Stack.Toolbar placement="${placement}": Fragment children are dropped by the header`);
    });
    return React.createElement(View, null, children);
  };
  Toolbar.Button = ({ children, onPress, disabled, accessibilityLabel }: any) =>
    React.createElement(
      Pressable,
      { accessibilityRole: "button", accessibilityLabel: accessibilityLabel ?? children, accessibilityState: { disabled: !!disabled }, disabled, onPress },
      React.createElement(Text, null, children),
    );
  Toolbar.View = ({ children }: any) => React.createElement(View, null, children);
  // Menus render open, so tests can press their actions directly.
  Toolbar.Menu = ({ children, title, accessibilityLabel }: any) =>
    React.createElement(View, { accessibilityLabel: accessibilityLabel ?? title }, children);
  Toolbar.MenuAction = ({ children, onPress, isOn, disabled }: any) =>
    React.createElement(
      Pressable,
      { accessibilityRole: "menuitem", accessibilityLabel: children, accessibilityState: { checked: !!isOn, disabled: !!disabled }, disabled, onPress },
      React.createElement(Text, null, children),
    );
  Object.defineProperty(Stack, "Toolbar", { value: Toolbar, configurable: true });
}

// Local notifications are native: tests get a mock they can inspect.
jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DATE: "date" },
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(async () => "id"),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  useLastNotificationResponse: jest.fn(() => null),
}));

// Saving to Photos is native (expo-media-library): in tests the permission is granted and the album doesn't exist.
jest.mock("expo-media-library", () => ({
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true, accessPrivileges: "all" })),
  Asset: { create: jest.fn(async () => ({ id: "asset" })) },
  Album: { get: jest.fn(async () => null), create: jest.fn(async () => ({ id: "album" })) },
}));

beforeEach(() => {
  (require("expo-file-system").File as { deleted: number }).deleted = 0;
});

// expo-video is native: in tests the player is an empty object and the view an empty View.
jest.mock("expo-video", () => {
  const { View } = require("react-native");
  return { useVideoPlayer: jest.fn(() => ({ loop: false })), VideoView: View };
});

