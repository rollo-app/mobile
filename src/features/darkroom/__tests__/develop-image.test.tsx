import { Skia } from "@shopify/react-native-skia";
import { render } from "@testing-library/react-native";
import type { SharedValue } from "react-native-reanimated";
import { DevelopImage } from "../develop-image";

// jest.setup mocks it for screen tests; here it's the real component over a mocked Skia.
jest.unmock("../develop-image");
jest.mock("@shopify/react-native-skia", () => {
  const { View } = require("react-native");
  const passthrough = ({ children }: { children?: unknown }) => children ?? null;
  return {
    Canvas: (props: object) => <View testID="develop-canvas" {...props} />,
    Group: passthrough,
    Rect: passthrough,
    Shader: passthrough,
    ImageShader: passthrough,
    Paint: passthrough,
    Blur: passthrough,
    rect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
    useClock: () => ({ value: 0 }),
    Skia: {
      Image: { MakeImageFromEncoded: jest.fn(() => ({})) },
      Data: { fromBytes: jest.fn(() => ({})) },
      RuntimeEffect: { Make: jest.fn(() => ({})) },
      Color: (c: string) => c,
    },
  };
});
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  useDerivedValue: (fn: () => unknown) => ({ get value() { return fn(); } }),
}));
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return { Image: (props: object) => <View testID="plain-image" {...props} /> };
});

function Harness({ thumbBytes, uri, headers }: { thumbBytes: ArrayBuffer | null; uri: string | null; headers?: Record<string, string> }) {
  const progress = { value: 0 } as SharedValue<number>;
  return <DevelopImage thumbBytes={thumbBytes} uri={uri} headers={headers} progress={progress} size={{ width: 100, height: 100 }} />;
}

describe("DevelopImage", () => {
  it("draws the Skia canvas when there are thumb bytes", async () => {
    const { getByTestId, queryByTestId } = await render(<Harness thumbBytes={new ArrayBuffer(8)} uri="https://x/y.jpg" />);
    expect(getByTestId("develop-canvas")).toBeTruthy();
    expect(queryByTestId("plain-image")).toBeNull();
  });

  it("falls back to the plain image without bytes", async () => {
    const { getByTestId, queryByTestId } = await render(<Harness thumbBytes={null} uri="https://x/y.jpg" />);
    expect(getByTestId("plain-image")).toBeTruthy();
    expect(queryByTestId("develop-canvas")).toBeNull();
  });

  it("falls back to the plain image when the shader doesn't compile", async () => {
    jest.mocked(Skia.RuntimeEffect.Make).mockReturnValueOnce(null);
    const { getByTestId, queryByTestId } = await render(<Harness thumbBytes={new ArrayBuffer(8)} uri="https://x/y.jpg" />);
    expect(getByTestId("plain-image")).toBeTruthy();
    expect(queryByTestId("develop-canvas")).toBeNull();
  });

  it("sends the headers with the plain image (media needs the session's Bearer)", async () => {
    const { getByTestId } = await render(<Harness thumbBytes={null} uri="https://x/y.jpg" headers={{ Authorization: "Bearer t" }} />);
    expect(getByTestId("plain-image").props.source).toEqual({ uri: "https://x/y.jpg", headers: { Authorization: "Bearer t" } });
  });
});
