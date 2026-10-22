import { render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import { Badge } from "../badge";

describe("Badge", () => {
  let loop: jest.SpyInstance;
  beforeEach(() => {
    loop = jest.spyOn(Animated, "loop");
  });
  afterEach(() => jest.restoreAllMocks());

  it("live shows its label and pulses the dot", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    await render(<Badge variant="live" label="EN VIVO" />);

    expect(await screen.findByText("EN VIVO")).toBeVisible();
    expect(screen.getByTestId("badge-dot")).toBeTruthy();
    expect(loop).toHaveBeenCalled();
  });

  it("live keeps the dot still with Reduce Motion on", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await render(<Badge variant="live" label="EN VIVO" />);

    expect(await screen.findByText("EN VIVO")).toBeVisible();
    expect(screen.getByTestId("badge-dot")).toBeTruthy();
    expect(loop).not.toHaveBeenCalled();
  });

  it("neutral is just the label, no dot", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    await render(<Badge variant="neutral" label="Revelado" />);

    expect(screen.getByText("Revelado")).toBeVisible();
    expect(screen.queryByTestId("badge-dot")).toBeNull();
    expect(loop).not.toHaveBeenCalled();
  });
});
