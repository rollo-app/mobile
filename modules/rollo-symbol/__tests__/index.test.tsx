import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import type { LockPhase } from "..";

type Lookup = { module: unknown; view?: () => unknown };

/** Loads the wrapper with the native module present or not (it is resolved once, at load). */
function load({ module, view }: Lookup) {
  let wrapper!: typeof import("..");
  jest.isolateModules(() => {
    // Only RolloSymbol is faked: expo-symbols (the fallback) also goes through `expo`.
    jest.doMock("expo", () => {
      const actual = jest.requireActual("expo");
      const nativeView = view ?? (() => () => <Text>native lock</Text>);
      return {
        ...actual,
        requireOptionalNativeModule: (name: string) => (name === "RolloSymbol" ? module : actual.requireOptionalNativeModule(name)),
        requireNativeView: (name: string, ...rest: unknown[]) =>
          name === "RolloSymbol" ? nativeView() : actual.requireNativeView(name, ...rest),
      };
    });
    wrapper = require("..");
  });
  return wrapper;
}

afterEach(() => jest.dontMock("expo"));

describe("RolloLockView", () => {
  it("uses the native view when the module is installed", async () => {
    const { RolloLockView } = load({ module: {} });
    const screen = await render(<RolloLockView phase="locked" />);
    expect(screen.getByText("native lock")).toBeTruthy();
  });

  it.each<[LockPhase, string]>([
    ["locked", "lock.fill"],
    ["unlocking", "lock.open.fill"],
    ["camera", "camera.fill"],
  ])("falls back to the SF Symbol for %s when the native module is missing", async (phase, symbol) => {
    const { RolloLockView } = load({ module: null });
    const screen = await render(<RolloLockView phase={phase} testID="lock" />);
    expect(screen.queryByText("native lock")).toBeNull();
    expect(screen.getByTestId("lock").props.name).toBe(symbol);
  });

  it("falls back when the native view can't be registered", async () => {
    const { RolloLockView } = load({
      module: {},
      view: () => {
        throw new Error("no view");
      },
    });
    const screen = await render(<RolloLockView phase="locked" testID="lock" />);
    expect(screen.getByTestId("lock").props.name).toBe("lock.fill");
  });
});
