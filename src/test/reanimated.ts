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
  default: { View },
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
  useAnimatedStyle: (style: () => object) => style(),
  withDelay: <T>(_ms: number, value: T) => value,
  withTiming: <T>(value: T) => value,
  // A sequence ends at its last step.
  withSequence: (...steps: unknown[]) => steps[steps.length - 1],
  Easing: { bezier: () => (t: number) => t },
  cubicBezier: () => "ease-out",
  ReduceMotion: { System: "system", Always: "always", Never: "never" },
});

export {};
