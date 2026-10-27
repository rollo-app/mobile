// Reanimated is native and its bundled mock doesn't load under Jest, so expo-router's testing library
// mocks it as an empty object. Importing this file (after the testing library, before the routes) fills
// that object with just enough to render: animations jump straight to their end value.
const { View } = jest.requireActual("react-native");

Object.assign(require("react-native-reanimated"), {
  __esModule: true,
  default: { View },
  // Backed by state, so setting it re-renders and animated styles show the end value.
  useSharedValue: <T>(initial: T) => {
    const [value, setValue] = jest.requireActual("react").useState(initial) as [T, (next: T) => void];
    return { value, get: () => value, set: setValue };
  },
  useAnimatedStyle: (style: () => object) => style(),
  withDelay: <T>(_ms: number, value: T) => value,
  withTiming: <T>(value: T) => value,
  Easing: { bezier: () => (t: number) => t },
  ReduceMotion: { System: "system", Always: "always", Never: "never" },
});

export {};
