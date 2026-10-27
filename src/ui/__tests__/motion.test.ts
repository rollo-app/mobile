jest.mock("react-native-reanimated", () => ({
  Easing: { bezier: jest.fn(() => "ease-out-curve") },
  ReduceMotion: { System: "system", Always: "always", Never: "never" },
}));

import { Easing } from "react-native-reanimated";
import { EASE_OUT_BEZIER, easeOut, ownedTiming } from "../motion";

describe("motion tokens", () => {
  it("builds the app's strong ease-out", () => {
    expect(easeOut()).toBe("ease-out-curve");
    expect(Easing.bezier).toHaveBeenCalledWith(0.23, 1, 0.32, 1);
    expect(EASE_OUT_BEZIER).toEqual([0.23, 1, 0.32, 1]);
  });

  it("keeps the duration and never lets Reanimated skip a timing that already chose its reduced variant", () => {
    expect(ownedTiming(300)).toEqual({ duration: 300, easing: "ease-out-curve", reduceMotion: "never" });
  });
});
