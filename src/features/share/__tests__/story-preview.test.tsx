import { render, screen } from "@testing-library/react-native";
import { useVideoPlayer } from "expo-video";
import { AppState, type AppStateStatus } from "react-native";
import { StoryPreview } from "../story-preview";

const player = { loop: false, muted: false, play: jest.fn() };
let listeners: ((s: AppStateStatus) => void)[] = [];
const remove = jest.fn();

beforeEach(() => {
  player.play.mockClear();
  remove.mockClear();
  listeners = [];
  jest.mocked(useVideoPlayer).mockReturnValue(player as never);
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, fn: (s: AppStateStatus) => void) => {
    listeners.push(fn);
    return { remove };
  }) as never);
});

describe("StoryPreview video", () => {
  it("resumes playing when the app comes back to the foreground (expo-video pauses it in the background)", async () => {
    await render(<StoryPreview style="dark" card={null} height={400} />);
    expect(listeners).toHaveLength(1);
    listeners[0]!("background");
    listeners[0]!("inactive");
    expect(player.play).not.toHaveBeenCalled();
    listeners[0]!("active");
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it("stops listening on unmount", async () => {
    const { unmount } = await render(<StoryPreview style="dark" card={null} height={400} />);
    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("shows a spinner while there is no card yet, and not once the card is there", async () => {
    const { rerender } = await render(<StoryPreview style="dark" card={null} height={400} />);
    expect(screen.getByLabelText("Armando la imagen")).toBeTruthy();
    await rerender(<StoryPreview style="dark" card={{ uri: "file:///c.png", width: 920, height: 1000 }} height={400} />);
    expect(screen.queryByLabelText("Armando la imagen")).toBeNull();
  });
});
