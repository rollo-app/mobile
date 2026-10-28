// Reanimated is native and its bundled mock doesn't load under Jest, so expo-router's testing library
// mocks it as an empty object. Importing this file (after the testing library, before the routes) fills
// that object with just enough to render: animations jump straight to their end value.
const { View } = jest.requireActual("react-native");

const layoutBuilder = () => {
  const builder: Record<string, unknown> = {};
  for (const name of ["duration", "easing", "delay", "reduceMotion"]) builder[name] = () => builder;
  return builder;
};

Object.assign(require("react-native-reanimated"), {
  __esModule: true,
  default: { View, createAnimatedComponent: <T>(component: T) => component },
  // Layout-animation builders: chainable, and inert (the animation props are ignored by the mock View).
  FadeIn: layoutBuilder(),
  FadeOut: layoutBuilder(),
  LinearTransition: layoutBuilder(),
  // Backed by state, so setting it re-renders and animated styles show the end value.
  useSharedValue: <T>(initial: T) => {
    const [value, setValue] = jest.requireActual("react").useState(initial) as [T, (next: T) => void];
    return { value, get: () => value, set: setValue };
  },
  // The keyboard is never open in tests.
  useAnimatedKeyboard: () => ({ height: { value: 0, get: () => 0 }, state: { value: 0, get: () => 0 } }),
  // Gesture Handler subscribes its worklet callbacks with these; in tests `fireGestureHandler` calls them directly.
  useEvent: () => () => {},
  useAnimatedStyle: (style: () => object) => style(),
  withDelay: <T>(_ms: number, value: T) => value,
  // Animations jump to their end value; the completion callback runs right away.
  withTiming: <T>(value: T, _config?: unknown, done?: (finished: boolean) => void) => {
    done?.(true);
    return value;
  },
  withSpring: <T>(value: T) => value,
  interpolate: (x: number, input: number[], output: number[]) => {
    const t = Math.min(1, Math.max(0, (x - input[0]!) / (input[1]! - input[0]!)));
    return output[0]! + t * (output[1]! - output[0]!);
  },
  Extrapolation: { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" },
  // A sequence ends at its last step.
  withSequence: (...steps: unknown[]) => steps[steps.length - 1],
  Easing: { bezier: () => (t: number) => t },
  cubicBezier: () => "ease-out",
  ReduceMotion: { System: "system", Always: "always", Never: "never" },
});

// ReanimatedSwipeable needs the native gesture/animation runtime: in tests it just renders the row and its right actions.
jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
  const { View } = jest.requireActual("react-native");
  const React = jest.requireActual("react");
  const Swipeable = ({ children, renderRightActions }: any) =>
    React.createElement(View, null, children, renderRightActions?.({ value: 0 }, { value: 0 }, { close() {}, openRight() {} }));
  return { __esModule: true, default: Swipeable };
});

export {};
