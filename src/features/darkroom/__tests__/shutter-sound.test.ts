import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { prepareShutter, releaseShutter } from "../shutter-sound";

jest.mock("expo-audio", () => ({
  setAudioModeAsync: jest.fn(async () => {}),
  createAudioPlayer: jest.fn(() => ({ play: jest.fn(), seekTo: jest.fn(), remove: jest.fn() })),
}));

afterEach(() => releaseShutter());

describe("prepareShutter", () => {
  it("loads the player without touching the app's audio mode", async () => {
    await prepareShutter();
    expect(createAudioPlayer).toHaveBeenCalled();
    expect(setAudioModeAsync).not.toHaveBeenCalled();
  });
});
