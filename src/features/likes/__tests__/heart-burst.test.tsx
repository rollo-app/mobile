import "expo-router/testing-library";
import { render, screen, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

// jest.setup mocks the heart out for the screens; here we render the real one.
jest.unmock("@/features/likes/heart-burst");
// Reanimated's bundled mock doesn't load under Jest (expo-router's testing library leaves it empty):
// fill it with just enough to render and to see which animations run.
const withSpring = jest.fn((value: number) => value);
const withTiming = jest.fn((value: number) => value);
Object.assign(require("react-native-reanimated"), {
  __esModule: true,
  default: { View: jest.requireActual("react-native").View },
  useSharedValue: (value: number) => ({ value }),
  useAnimatedStyle: (style: () => object) => style(),
  withDelay: (_ms: number, value: number) => value,
  withSequence: (...values: number[]) => values[values.length - 1],
  withSpring,
  withTiming,
});
const { HeartBurst } = require("../heart-burst") as typeof import("../heart-burst");

beforeEach(() => {
  withSpring.mockClear();
  withTiming.mockClear();
});

describe("HeartBurst", () => {
  it("shows nothing until the first double tap", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    await render(<HeartBurst burst={0} />);
    expect(screen.queryByTestId("heart-burst", { includeHiddenElements: true })).toBeNull();
  });

  it("pops the heart with a spring", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    await render(<HeartBurst burst={1} />);
    expect(screen.getByTestId("heart-burst", { includeHiddenElements: true })).toBeTruthy();
    await waitFor(() => expect(withSpring).toHaveBeenCalled());
  });

  it("with Reduce Motion it only fades, without scaling", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await render(<HeartBurst burst={1} />);
    await waitFor(() => expect(withTiming).toHaveBeenCalled());
    expect(withSpring).not.toHaveBeenCalled();
  });
});
