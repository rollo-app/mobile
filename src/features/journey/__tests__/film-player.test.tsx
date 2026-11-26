import { act, fireEvent, render } from "@testing-library/react-native";
import { useReduceMotion } from "@/ui/use-reduce-motion";
import type { Assets } from "../engine/draw";
import type { Scene } from "../engine/model";
import { FilmPlayer } from "../film-player";

// jest.setup mocks it for screen tests; here it's the real component over a mocked Skia.
jest.unmock("@/features/journey/film-player");
jest.mock("@shopify/react-native-skia", () => {
  const { View } = require("react-native");
  const passthrough = ({ children }: { children?: unknown }) => children ?? null;
  return {
    Canvas: (props: object) => <View testID="film-canvas" {...props} />,
    Group: passthrough,
    Picture: () => null,
    useClock: () => ({ value: 0 }),
    Skia: {
      PictureRecorder: () => ({
        beginRecording: () => ({}),
        finishRecordingAsPicture: () => ({}),
      }),
      XYWHRect: (x: number, y: number, w: number, h: number) => ({ x, y, w, h }),
    },
  };
});
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  return {
    __esModule: true,
    useSharedValue: (initial: unknown) => React.useRef({ value: initial }).current,
    useDerivedValue: (fn: () => unknown) => ({
      get value() {
        return fn();
      },
    }),
  };
});
jest.mock("../engine/draw", () => ({ drawFrame: jest.fn() }));
jest.mock("../engine/scene", () => ({ frameAt: jest.fn(() => ({})) }));
jest.mock("@/ui/use-reduce-motion", () => ({ useReduceMotion: jest.fn() }));

const useReduceMotionMock = jest.mocked(useReduceMotion);
const scene = { durationMs: 1000, input: { timeline: { doneAt: 800 } } } as unknown as Scene;
const assets = { layers: [], photos: {}, texts: [] } as unknown as Assets;

function player(extra: Partial<Parameters<typeof FilmPlayer>[0]> = {}) {
  return <FilmPlayer scene={scene} assets={assets} height={640} playing paused={false} {...extra} />;
}

beforeEach(() => {
  jest.useFakeTimers();
  useReduceMotionMock.mockReturnValue(false);
});
afterEach(() => jest.useRealTimers());

describe("FilmPlayer", () => {
  it("is a 9:16 box of the given height", async () => {
    const { getByTestId } = await render(player());
    expect(getByTestId("film-player")).toHaveStyle({ width: 360, height: 640 });
  });

  it("shows no button without reduce motion, and calls onEnd once when the film ends", async () => {
    const onEnd = jest.fn();
    const { queryByRole } = await render(player({ onEnd }));
    expect(queryByRole("button", { name: "Reproducir" })).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(999);
    });
    expect(onEnd).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("with reduce motion shows the Reproducir button and does not start by itself", async () => {
    useReduceMotionMock.mockReturnValue(true);
    const onEnd = jest.fn();
    const { getByRole } = await render(player({ onEnd }));
    expect(getByRole("button", { name: "Reproducir" })).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("pressing Reproducir plays once and hides the button", async () => {
    useReduceMotionMock.mockReturnValue(true);
    const onEnd = jest.fn();
    const { getByRole, queryByRole } = await render(player({ onEnd }));
    await fireEvent.press(getByRole("button", { name: "Reproducir" }));
    expect(queryByRole("button", { name: "Reproducir" })).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("does not start while reduce motion is still unknown", async () => {
    useReduceMotionMock.mockReturnValue(null);
    const onEnd = jest.fn();
    const { queryByRole } = await render(player({ onEnd }));
    expect(queryByRole("button", { name: "Reproducir" })).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(onEnd).not.toHaveBeenCalled();
  });
});
