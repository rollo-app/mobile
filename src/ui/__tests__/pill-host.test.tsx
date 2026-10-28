import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import { PillHost } from "../pill-host";
import { showPill } from "../pill";

jest.mock("react-native-screens", () => ({
  FullWindowOverlay: ({ children }: { children: unknown }) => children,
}));

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("PillHost", () => {
  it("renders nothing until a pill is shown", async () => {
    await render(<PillHost />);
    expect(screen.queryByText("Destacada en tu perfil", { includeHiddenElements: true })).toBeNull();
  });

  it("shows the text, announces it and hides it after the timers", async () => {
    await render(<PillHost />);
    await act(async () => {
      showPill("Destacada en tu perfil");
    });
    expect(screen.getByText("Destacada en tu perfil", { includeHiddenElements: true })).toBeTruthy();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith("Destacada en tu perfil");
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.queryByText("Destacada en tu perfil", { includeHiddenElements: true })).toBeNull();
  });

  it("never resets the pill to invisible when another one arrives (it continues from where it is)", async () => {
    const setValue = jest.spyOn(Animated.Value.prototype, "setValue");
    await render(<PillHost />);
    await act(async () => {
      showPill("Destacada en tu perfil");
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
      showPill("Destacada en tu perfil");
    });
    expect(setValue).not.toHaveBeenCalledWith(0);
    expect(screen.getByText("Destacada en tu perfil", { includeHiddenElements: true })).toBeTruthy();
  });
});
